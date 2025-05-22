import os
import fitz  # PyMuPDF
import openai
from supabase import create_client, Client
from dotenv import load_dotenv

# Load .env file
load_dotenv()

# Set API keys and Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
client = openai.OpenAI(api_key=OPENAI_API_KEY)

# Constants
BUCKET_NAME = "uploads"
LOCAL_DOWNLOAD_PATH = "downloaded.pdf"

def get_next_upload():
    """Fetch the next unprocessed upload."""
    response = supabase.table("uploads").select("*").eq("status", "processing").limit(1).execute()
    items = response.data
    if not items:
        print("No uploads to process.")
        return None
    return items[0]

def download_pdf(file_name):
    """Download a PDF file from Supabase Storage."""
    print(f"Downloading {file_name}...")
    res = supabase.storage.from_(BUCKET_NAME).download(file_name)
    with open(LOCAL_DOWNLOAD_PATH, "wb") as f:
        f.write(res)
    return LOCAL_DOWNLOAD_PATH

def extract_text(path):
    """Extract text and page count from a PDF."""
    doc = fitz.open(path)
    text = ""
    for page in doc:
        text += page.get_text()
    return text.strip(), len(doc)


def extract_title(text):
    """Extract the likely article title using OpenAI."""
    prompt = f"What is the full title of this academic article?\n\n{text[:1000]}\n\nTitle:"
    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=60,
        temperature=0.2
    )
    return response.choices[0].message.content.strip()

def extract_authors(text):
    """Extract a comma-separated list of author names using OpenAI."""
    prompt = f"List all the author names of this academic article as a comma-separated list:\n\n{text[:1000]}"
    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=100,
        temperature=0.2
    )
    return response.choices[0].message.content.strip()

def summarize_text(text):
    """Summarize the given text using OpenAI."""
    prompt = f"Summarize the following medical research article:\n\n{text}\n\nSummary:"
    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=500,
        temperature=0.4
    )
    return response.choices[0].message.content.strip()

def insert_article(upload_id, title, summary, content, authors_string, page_count):
    """Insert article and related author records into Supabase."""
    existing = supabase.table("articles").select("id").eq("upload_id", upload_id).execute()
    if existing.data:
        print("Article already exists for this upload. Skipping.")
        return

    # Insert article
    insert_result = supabase.table("articles").insert({
        "upload_id": upload_id,
        "title": title,
        "summary": summary,
        "content": content,
        "category": "uncategorized",
        "model_used": "gpt-3.5-turbo",
        "page_count": page_count
    }).execute()

    if not insert_result.data:
        print("Error inserting article.")
        return

    article_id = insert_result.data[0]["id"]

    # Parse authors
    author_names = [a.strip() for a in authors_string.split(",") if a.strip()]
    for idx, name in enumerate(author_names):
        # Check for existing author
        author_resp = supabase.table("authors").select("id").ilike("full_name", name).limit(1).execute()
        if author_resp.data:
            author_id = author_resp.data[0]["id"]
        else:
            # Insert new author
            author_insert = supabase.table("authors").insert({"full_name": name}).execute()
            author_id = author_insert.data[0]["id"]

        # Link author to article
        supabase.table("article_authors").insert({
            "article_id": article_id,
            "author_id": author_id,
            "display_order": idx + 1
        }).execute()

def mark_upload_complete(upload_id):
    supabase.table("uploads").update({"status": "complete"}).eq("id", upload_id).execute()

if __name__ == "__main__":
    while True:
        upload = get_next_upload()
        if not upload:
            break

        file_name = upload["file_name"]
        upload_id = upload["id"]

        pdf_path = download_pdf(file_name)
        full_text, page_count = extract_text(pdf_path)
        summary = summarize_text(full_text)
        title_guess = extract_title(full_text)
        authors = extract_authors(full_text)

        insert_article(upload_id, title_guess, summary, full_text, authors, page_count)
        mark_upload_complete(upload_id)

        print(f"✓ Processed: {file_name}")