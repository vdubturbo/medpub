import os
from transformers import pipeline
from supabase import create_client, Client
from dotenv import load_dotenv

# Load .env
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Initialize classifier
classifier = pipeline("zero-shot-classification", model="facebook/bart-large-mnli")

# Seed labels (editable anytime)
initial_labels = [
    "oncology", "cardiology", "neurology", "pharmacology",
    "epidemiology", "public health", "methods", "policy", "genetics", "general"
]

def fetch_uncategorized_articles():
    """Get articles with no entries in article_categories."""
    existing = supabase.table("article_categories").select("article_id").execute()
    categorized_ids = {row["article_id"] for row in existing.data}
    all_articles = supabase.table("articles").select("*").execute()
    return [a for a in all_articles.data if a["id"] not in categorized_ids]

def check_or_create_category(label):
    """Ensure the category exists and return its ID."""
    exists = supabase.table("categories").select("id").eq("name", label).execute()
    if exists.data:
        return exists.data[0]["id"]
    created = supabase.table("categories").insert({"name": label}).execute()
    return created.data[0]["id"]

def categorize_articles():
    articles = fetch_uncategorized_articles()
    if not articles:
        print("No uncategorized articles found.")
        return

    for article in articles:
        summary = article["summary"] or article["content"][:1024]
        result = classifier(summary, initial_labels, multi_label=True)

        for label, score in zip(result["labels"], result["scores"]):
            if score >= 0.5:
                category_id = check_or_create_category(label)
                supabase.table("article_categories").insert({
                    "article_id": article["id"],
                    "category_id": category_id,
                    "confidence": score
                }).execute()

        print(f"✓ Categorized '{article['title']}' with {len(result['labels'])} label(s)")

if __name__ == "__main__":
    categorize_articles()