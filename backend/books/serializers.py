from rest_framework import serializers
from .models import Book, BookChunk

class BookChunkSerializer(serializers.ModelSerializer):
    class Meta:
        model = BookChunk
        fields = ['id', 'chunk_text', 'chunk_index']

class BookSerializer(serializers.ModelSerializer):
    class Meta:
        model = Book
        fields = '__all__'

class BookListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Book
        fields = ['id', 'title', 'author', 'rating', 'description', 'book_url', 'cover_image_url', 'genre']

class BookDetailSerializer(serializers.ModelSerializer):
    chunks = BookChunkSerializer(many=True, read_only=True)
    
    class Meta:
        model = Book
        fields = '__all__'
        depth = 1
