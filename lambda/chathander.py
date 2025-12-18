import json
import os
from google import genai
from google.genai import types
import pg8000.dbapi

# Initialize Client
client = genai.Client(api_key=os.environ["GOOGLE_API_KEY"])

def lambda_handler(event, context):
    print("Received event:", json.dumps(event))
    
    try:
        body = json.loads(event.get('body', '{}'))
        question = body.get('question', '')
        user_id = body.get('user_id', '')

        if not question:
            return {"statusCode": 400, "body": json.dumps({"error": "No question provided"})}
        
        if not user_id:
            print("ERROR: User ID is missing from request body")
            return {"statusCode": 400, "body": json.dumps({"error": "User ID is required"})}

        embed_resp = client.models.embed_content(
            model="text-embedding-004",
            contents=question
        )
        q_emb = embed_resp.embeddings[0].values

        conn = pg8000.dbapi.connect(
            host=os.environ['DB_HOST'], 
            database=os.environ['DB_NAME'],
            user=os.environ['DB_USER'], 
            password=os.environ['DB_PASS']
        )
        cur = conn.cursor()
        
        # This query joins the notes with the document table to get the filename
        query = """
            SELECT sn.content, ud.file_name
            FROM study_notes sn
            JOIN user_documents ud ON sn.document_id = ud.id
            WHERE sn.user_id = %s
            ORDER BY sn.embedding <-> %s::vector
            LIMIT 5
        """
        cur.execute(query, (user_id, str(q_emb)))
        results = cur.fetchall()
        conn.close()

        print(f"Found {len(results)} matches.")

        if not results:
            context_text = "No relevant study notes found."
        else:
            context_parts = []
            for row in results:
                text_chunk = row[0]
                filename = row[1]
                context_parts.append(f"Source: {filename}\nContent: {text_chunk}")
            context_text = "\n\n".join(context_parts)

        system_instruction = (
            "You are a helpful study assistant. Use the provided context to answer the question. "
            "Always cite the source file name when using information from the context."
        )
        
        prompt = f"Context:\n{context_text}\n\nQuestion: {question}\nAnswer:"
        
        generate_resp = client.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=prompt,
            config=types.GenerateContentConfig(system_instruction=system_instruction)
        )

        return {
            "statusCode": 200,
            "body": json.dumps({"answer": generate_resp.text}),
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json"
            }
        }
        
    except Exception as e:
        print(f"CRITICAL ERROR: {e}")
        return {
            "statusCode": 500, 
            "body": json.dumps({"error": str(e)}),
            "headers": {"Access-Control-Allow-Origin": "*"}
        }