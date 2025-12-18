import json, os, time, boto3
from google import genai
import pg8000.dbapi
from pypdf import PdfReader
from io import BytesIO
from urllib.parse import unquote_plus

client = genai.Client(api_key=os.environ["GOOGLE_API_KEY"])
s3 = boto3.client('s3')

def lambda_handler(event, context):
    print("STARTING INGESTION...")
    try:
        bucket = event['Records'][0]['s3']['bucket']['name']
        rawKey = event['Records'][0]['s3']['object']['key']
        key = unquote_plus(rawKey)
        print(f"Processing: {key}")

        path_parts = key.split("/")
        if len(path_parts) >= 3 and path_parts[0] == "uploads":
            user_id = path_parts[1]
            filename = path_parts[-1]
        elif len(path_parts) == 2:
            user_id = path_parts[0]
            filename = path_parts[1]
        else:
            print("SKIPPING: Bad path")
            return

        conn = pg8000.dbapi.connect(
            host=os.environ['DB_HOST'], database=os.environ['DB_NAME'],
            user=os.environ['DB_USER'], password=os.environ['DB_PASS']
        )
        cur = conn.cursor()

        cur.execute("SELECT id FROM user_documents WHERE s3_key = %s", (key,))
        existing = cur.fetchone()
        if existing:
            document_id = existing[0]
            print(f"Document already exists ID: {document_id}")
            # cur.execute("DELETE FROM study_notes WHERE document_id = %s", (document_id,))
        else:
            cur.execute(
                "INSERT INTO user_documents (user_id, file_name, s3_key) VALUES (%s, %s, %s) RETURNING id",
                (user_id, filename, key)
            )
            document_id = cur.fetchone()[0]
            conn.commit()
            print(f"Created new Document ID: {document_id}")

        response = s3.get_object(Bucket=bucket, Key=key)
        reader = PdfReader(BytesIO(response['Body'].read()))
        text = "".join([page.extract_text() or "" for page in reader.pages])
        
        if len(text) < 50:
            print("ERROR: PDF has no text! Is it a scanned image?")
            return {"statusCode": 400, "body": "PDF is empty or scanned image"}

        chunks = [text[i:i+1000] for i in range(0, len(text), 1000)]
        print(f"Chunks to embed: {len(chunks)}")

        for i, chunk in enumerate(chunks):
            if len(chunk) < 50: continue
            time.sleep(1) 
            
            try:
                resp = client.models.embed_content(
                    model="text-embedding-004", 
                    contents=chunk
                )
                emb = resp.embeddings[0].values
                
                cur.execute(
                    "INSERT INTO study_notes (content, embedding, user_id, document_id) VALUES (%s, %s, %s, %s)", 
                    (chunk, str(emb), user_id, document_id)
                )
                conn.commit() # SAVE EACH CHUNK individually
                print(f"Saved chunk {i+1}/{len(chunks)}")
                
            except Exception as e:
                print(f"Failed chunk {i}: {e}")
                # Don't crash, just keep going
                continue

        cur.close()
        conn.close()
        return {"statusCode": 200, "body": "Success"}

    except Exception as e:
        print(f"CRITICAL ERROR: {e}")
        raise e