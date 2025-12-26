import azure.functions as func
import logging
import json
import os
import ssl
from io import BytesIO
from datetime import datetime, timedelta

# Import libraries but DO NOT initialize clients here
import pg8000.dbapi
from pypdf import PdfReader
from google import genai
from google.genai import types
from azure.storage.blob import (
    BlobServiceClient,
    generate_blob_sas,
    BlobSasPermissions
)

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

class DatabaseConnection:
    def __enter__(self):
        self.ssl_context = ssl.create_default_context()
        self.ssl_context.check_hostname = False
        self.ssl_context.verify_mode = ssl.CERT_NONE
        
        self.conn = pg8000.dbapi.connect(
            host=os.environ["DB_HOST"],
            database=os.environ["DB_NAME"],
            user=os.environ["DB_USER"],
            password=os.environ["DB_PASS"],
            ssl_context=self.ssl_context
        )
        return self.conn

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.conn:
            try:
                self.conn.close()
            except:
                pass

def get_gemini_client():
    return genai.Client(api_key=os.environ["GEMINI_API_KEY"])

def get_blob_service_client():
    return BlobServiceClient.from_connection_string(os.environ["AzureWebJobsStorage"])

# 1. CHAT HANDLER
@app.route(route="chat", methods=["POST"])
def ChatHandler(req: func.HttpRequest) -> func.HttpResponse:
    try:
        body = req.get_json()
        question = body.get("question")
        user_id = body.get("user_id")

        if not question or not user_id:
            return func.HttpResponse(json.dumps({"error": "Missing inputs"}), status_code=400)

        client = get_gemini_client()

        embed_resp = client.models.embed_content(model="text-embedding-004", contents=question)
        q_emb = embed_resp.embeddings[0].values

        with DatabaseConnection() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT sn.content, ud.file_name
                FROM study_notes sn
                JOIN user_documents ud ON sn.document_id = ud.id
                WHERE sn.user_id = %s
                ORDER BY sn.embedding <-> %s::vector
                LIMIT 5
                """,
                (user_id, str(q_emb))
            )
            results = cur.fetchall()
            cur.close()

        context_text = "\n\n".join([f"Source: {row[1]}\nContent: {row[0]}" for row in results]) or "No notes found."
        
        # Generate
        prompt = f"Context:\n{context_text}\n\nQuestion: {question}\nAnswer:"
        response = client.models.generate_content(
            model="gemini-2.5-flash-lite", 
            contents=prompt
        )

        return func.HttpResponse(json.dumps({"answer": response.text}), mimetype="application/json")

    except Exception as e:
        logging.error(f"Chat Error: {str(e)}")
        return func.HttpResponse(json.dumps({"error": str(e)}), status_code=500)

# 2. INGEST HANDLER (EVENT GRID TRIGGER)
@app.event_grid_trigger(arg_name="event")
def IngestHandler(event: func.EventGridEvent):
    try:
        data = event.get_json()
        
        logging.info(f"Received Event Data: {json.dumps(data)}")

        blob_url = data['url'] 
        
        logging.info(f"⚡ EVENT RECEIVED for file: {blob_url}")

        parts = blob_url.split('/')
        filename = parts[-1]
        user_id = parts[-2]
        
        blob_path_inside_container = f"{user_id}/{filename}"

        blob_service = get_blob_service_client()
        blob_client = blob_service.get_blob_client(container="pdfs", blob=blob_path_inside_container)
        
        download_stream = blob_client.download_blob()
        file_bytes = BytesIO(download_stream.readall())

        logging.info(f"Downloading complete. Size: {file_bytes.getbuffer().nbytes} bytes")

        client = get_gemini_client()
        
        with DatabaseConnection() as conn:
            cur = conn.cursor()

            # Check Existing
            cur.execute("SELECT id FROM user_documents WHERE s3_key = %s", (blob_url,))
            existing = cur.fetchone()

            if existing:
                logging.info("File already exists in DB. Skipping.")
                document_id = existing[0]
            else:
                cur.execute(
                    "INSERT INTO user_documents (user_id, file_name, s3_key) VALUES (%s, %s, %s) RETURNING id",
                    (user_id, filename, blob_url)
                )
                document_id = cur.fetchone()[0]
                conn.commit()

            # Read PDF
            try:
                reader = PdfReader(file_bytes)
                text = "".join([page.extract_text() or "" for page in reader.pages])
            except Exception:
                logging.error("PDF Corrupt or Unreadable")
                return

            chunks = [text[i:i+1000] for i in range(0, len(text), 1000) if len(text[i:i+1000]) > 50]
            
            # Embed & Save
            for chunk in chunks:
                emb_resp = client.models.embed_content(model="text-embedding-004", contents=chunk)
                emb = emb_resp.embeddings[0].values
                cur.execute(
                    "INSERT INTO study_notes (content, embedding, user_id, document_id) VALUES (%s, %s, %s, %s)",
                    (chunk, str(emb), user_id, document_id)
                )
            
            conn.commit()
            cur.close()
            logging.info("🎉 Ingestion Success!")

    except Exception as e:
        logging.error(f"Ingest Error: {str(e)}")
        
# 3. LIST DOCUMENTS
@app.route(route="documents", methods=["GET"])
def ListDocumentHandler(req: func.HttpRequest) -> func.HttpResponse:
    user_id = req.params.get("user_id")
    if not user_id:
        return func.HttpResponse(json.dumps({"error": "Missing user_id"}), status_code=400)

    try:
        blob_service_client = get_blob_service_client()
        
        documents = []
        with DatabaseConnection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT id, file_name, s3_key, created_at FROM user_documents WHERE user_id = %s", (user_id,))
            rows = cur.fetchall()
            cur.close()

            for row in rows:
                doc_id, name, key, created = row
                if "https://" in key:
                    blob_name = "/".join(key.split('/pdfs/')[-1].split('/'))
                else:
                    blob_name = "/".join(key.split('/')[1:])
                
                sas_token = generate_blob_sas(
                    account_name=blob_service_client.account_name,
                    container_name="pdfs",
                    blob_name=blob_name,
                    account_key=blob_service_client.credential.account_key,
                    permission=BlobSasPermissions(read=True),
                    expiry=datetime.utcnow() + timedelta(hours=1)
                )
                url = f"{blob_service_client.url}pdfs/{blob_name}?{sas_token}"
                documents.append({"id": str(doc_id), "name": name, "url": url, "created_at": str(created)})

        return func.HttpResponse(json.dumps(documents), mimetype="application/json")

    except Exception as e:
        logging.error(f"List Docs Error: {str(e)}")
        return func.HttpResponse(json.dumps({"error": str(e)}), status_code=500)

# 4. GET UPLOAD URL
@app.route(route="get_upload_url", methods=["POST"])
def GetUploadUrl(req: func.HttpRequest) -> func.HttpResponse:
    try:
        body = req.get_json()
        filename = body.get("filename")
        user_id = body.get("user_id")

        if not filename or not user_id:
            return func.HttpResponse(json.dumps({"error": "Missing inputs"}), status_code=400)

        blob_name = f"{user_id}/{filename}"
        blob_service_client = get_blob_service_client()

        sas_token = generate_blob_sas(
            account_name=blob_service_client.account_name,
            container_name="pdfs",
            blob_name=blob_name,
            account_key=blob_service_client.credential.account_key,
            permission=BlobSasPermissions(write=True),
            expiry=datetime.utcnow() + timedelta(minutes=10)
        )

        upload_url = f"{blob_service_client.url}pdfs/{blob_name}?{sas_token}"

        return func.HttpResponse(
            json.dumps({"uploadUrl": upload_url, "blobName": blob_name}),
            mimetype="application/json"
        )

    except Exception as e:
        return func.HttpResponse(json.dumps({"error": str(e)}), status_code=500)