from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator

class Book(models.Model):
    title = models.CharField(max_length=500)
    author = models.CharField(max_length=500)
    description = models.TextField()
    rating = models.FloatField(validators=[MinValueValidator(0), MaxValueValidator(5)], null=True, blank=True)
    review_count = models.IntegerField(default=0)
    book_url = models.URLField(max_length=1000)
    cover_image_url = models.URLField(max_length=1000, null=True, blank=True)
    publication_year = models.IntegerField(null=True, blank=True)
    isbn = models.CharField(max_length=20, null=True, blank=True)
    genre = models.CharField(max_length=200, null=True, blank=True)
    summary = models.TextField(null=True, blank=True)
    sentiment_score = models.FloatField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        
    def __str__(self):
        return f"{self.title} by {self.author}"

class BookChunk(models.Model):
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name='chunks')
    chunk_text = models.TextField()
    chunk_index = models.IntegerField()
    embedding_id = models.CharField(max_length=100, null=True, blank=True)
    
    class Meta:
        unique_together = ['book', 'chunk_index']
