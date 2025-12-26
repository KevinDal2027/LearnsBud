import json
import os
import boto3
import pg8000.dbapi

s3 = boto3.client('s3')

def lambda_handler(event, context):
    print("Received event:", json.dumps(event))
    
    try:
        query_params = event.get('queryStringParameters', {})
        if not query_params:
            print("Error: No query parameters found")
            return {
                "statusCode": 400, 
                "headers": {"Access-Control-Allow-Origin": "*"},
                "body": json.dumps({"error": "Missing query parameters"})
            }
            
        user_id = query_params.get('user_id')
        
        if not user_id:
            print("Error: user_id is missing")
            return {
                "statusCode": 400, 
                "headers": {"Access-Control-Allow-Origin": "*"},
                "body": json.dumps({"error": "Missing user_id parameter"})
            }

        print(f"Fetching documents for User ID: {user_id}")

        conn = pg8000.dbapi.connect(
            host=os.environ['DB_HOST'], 
            database=os.environ['DB_NAME'],
            user=os.environ['DB_USER'], 
            password=os.environ['DB_PASS']
        )
        cur = conn.cursor()
        
        cur.execute(
            """
            SELECT id, file_name, s3_key, created_at 
            FROM user_documents 
            WHERE user_id = %s 
            ORDER BY created_at DESC
            """,
            (user_id,)
        )
        rows = cur.fetchall()
        print(f"Found {len(rows)} documents")
        
        documents = []
        for row in rows:
            doc_id, name, key, created = row
            
            try:
                url = s3.generate_presigned_url(
                    'get_object',
                    Params={'Bucket': 'kevin-nguyen-csci3124-project', 'Key': key},
                    ExpiresIn=3600 
                )
            except Exception as s3_err:
                print(f"Error generating URL for key {key}: {s3_err}")
                url = None

            documents.append({
                "id": str(doc_id),
                "name": name,
                "url": url,
                "created_at": str(created)
            })

        cur.close()
        conn.close()

        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json"
            },
            "body": json.dumps(documents)
        }

    except Exception as e:
        print(f"CRITICAL ERROR: {e}")
        return {
            "statusCode": 500, 
            "headers": {"Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": str(e)})
        }