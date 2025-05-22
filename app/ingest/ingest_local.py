import os
import fitz  # PyMuPDF
from transformers import pipeline
from supabase import create_client, Client
from dotenv import load_dotenv

# Load .env file
load_dotenv()

# Set API keys and Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Initialize the summarization pipeline
summarizer = pipeline("summarization", model="facebook/bart-large-cnn")

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
    """Extract the likely title from the start of the article."""
    trimmed = text[:1024]
    prompt = f"Extract the full title of this academic article:\n\n{trimmed}\n\nTitle:"
    result = summarizer(prompt, max_length=30, min_length=5, do_sample=False)
    return result[0]['summary_text'].strip()

# === TEST CODE: Heuristic-based author extraction from first page ===
import re

def extract_authors_heuristic(text):
    """Extract likely author names from the beginning of the article using regex pattern matching."""
    lines = text.splitlines()
    for i, line in enumerate(lines[:20]):
        if (
            len(line) > 40
            and ',' in line
            and re.search(r'[A-Z][a-z]+ [A-Z]\.', line)  # Matches names like 'John M.'
        ):
            return line.strip()
    return "Unknown"

def extract_authors(text):
    """Extract a list of authors from the article intro text."""
    trimmed = text[:1024]
    prompt = f"List all author names for this academic article based on the following introduction:\n\n{trimmed}\n\nAuthors:"
    result = summarizer(prompt, max_length=60, min_length=5, do_sample=False)
    return result[0]['summary_text'].strip()

def summarize_text(text):
    """Summarize using bart-large-cnn (offline)."""
    trimmed = text[:4096]  # BART handles up to ~1024 tokens
    summary = summarizer(trimmed, max_length=180, min_length=40, do_sample=False)
    return summary[0]['summary_text']

def insert_article(upload_id, title, summary, content, file_name, authors_string, page_count):
    """Insert article and related author records into Supabase."""
    existing = supabase.table("articles").select("id").eq("upload_id", upload_id).execute()
    if existing.data:
        print("Article already exists for this upload. Skipping.")
        return

    insert_result = supabase.table("articles").insert({
        "upload_id": upload_id,
        "title": title,
        "summary": summary,
        "content": content,
        "original_file_name": file_name,
        "category": "uncategorized",
        "model_used": "bart-large-cnn",
        "page_count": page_count
    }).execute()

    if not insert_result.data:
        print("Error inserting article.")
        return

    article_id = insert_result.data[0]["id"]

    # Parse authors
    author_names = [a.strip() for a in authors_string.split(",") if a.strip()]
    for idx, name in enumerate(author_names):
        author_resp = supabase.table("authors").select("id").ilike("full_name", name).limit(1).execute()
        if author_resp.data:
            author_id = author_resp.data[0]["id"]
        else:
            author_insert = supabase.table("authors").insert({"full_name": name}).execute()
            author_id = author_insert.data[0]["id"]

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
        insert_article(upload_id, title_guess, summary, full_text, file_name, authors, page_count)
        mark_upload_complete(upload_id)

        print(f"✓ Processed: {file_name}")