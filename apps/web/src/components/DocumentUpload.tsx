import React, { useState, useRef } from 'react';

interface DocumentUploadProps {
  onUploadSuccess?: (documentId: string, chunksCreated: number) => void;
}

export function DocumentUpload({ onUploadSuccess }: DocumentUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [documentId, setDocumentId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = (fileList: FileList | File[]) => {
    const newFiles = Array.from(fileList);
    setFiles(prev => [...prev, ...newFiles]);
    
    // Auto-generate document ID from first file if empty
    if (!documentId && newFiles.length > 0) {
      const id = newFiles[0].name
        .replace(/\.[^/.]+$/, '') // Remove extension
        .replace(/[^a-zA-Z0-9-_]/g, '-'); // Sanitize
      setDocumentId(id);
    }
    setError('');
    setSuccess('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0 || !documentId) {
      setError('Please select at least one file and provide a document ID');
      return;
    }

    setUploading(true);
    setError('');
    setSuccess('');

    try {
      // Get JWT token from localStorage or context
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Not authenticated. Please log in.');
      }

      let totalChunks = 0;

      // Upload each file
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        
        // Use file-specific document ID for multiple files
        const fileDocId = files.length > 1 
          ? `${documentId}-${file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9-_]/g, '-')}`
          : documentId;
        
        formData.append('documentId', fileDocId);
        formData.append('metadata', JSON.stringify({
          filename: file.name,
          size: file.size,
          type: file.type,
          uploadedAt: new Date().toISOString(),
        }));

        const response = await fetch('/v1/rag/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Upload failed for ${file.name}`);
        }

        const result = await response.json();
        totalChunks += result.chunksIngested || 0;
      }

      setSuccess(`✅ Successfully uploaded ${files.length} file(s)! Created ${totalChunks} chunks total.`);
      setFiles([]);
      setDocumentId('');
      
      if (onUploadSuccess) {
        onUploadSuccess(documentId, totalChunks);
      }

    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Upload Documents for RAG</h3>
      
      <div className="space-y-4">
        {/* Drag & Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
            transition-colors duration-200
            ${dragOver 
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
            }
            ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.pdf,.docx,.tex,.json,.csv,.log"
            onChange={handleFileChange}
            disabled={uploading}
            multiple
            className="hidden"
          />
          
          <div className="space-y-2">
            <div className="text-4xl">📄</div>
            <p className="text-sm font-medium">
              {dragOver ? 'Drop files here' : 'Drag & drop files or click to browse'}
            </p>
            <p className="text-xs text-gray-500">
              Supports: .txt, .md, .pdf, .docx, .tex, .json, .csv, .log
            </p>
          </div>
        </div>

        {/* Selected Files List */}
        {files.length > 0 && (
          <div className="space-y-2">
            <label className="block text-sm font-medium">
              Selected Files ({files.length})
            </label>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded"
                >
                  <div className="flex-1 truncate text-sm">
                    <span className="font-medium">{file.name}</span>
                    <span className="text-gray-500 ml-2">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <button
                    onClick={() => removeFile(index)}
                    disabled={uploading}
                    className="ml-2 text-red-500 hover:text-red-700 disabled:opacity-50"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Document ID */}
        {files.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-2">
              Document ID {files.length > 1 && <span className="text-gray-500">(base name)</span>}
            </label>
            <input
              type="text"
              value={documentId}
              onChange={(e) => setDocumentId(e.target.value)}
              disabled={uploading}
              placeholder="unique-document-id"
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
            />
            <p className="text-xs text-gray-500 mt-1">
              {files.length > 1 
                ? 'Each file will be suffixed with its filename for uniqueness'
                : 'This ID will be used to identify and delete the document later'
              }
            </p>
          </div>
        )}

        {/* Upload Button */}
        <button
          onClick={handleUpload}
          disabled={files.length === 0 || !documentId || uploading}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {uploading ? '📤 Uploading...' : `📤 Upload ${files.length > 0 ? `${files.length} Document${files.length > 1 ? 's' : ''}` : 'Documents'}`}
        </button>

        {/* Success Message */}
        {success && (
          <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-800 dark:text-green-200">
            {success}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
            ❌ {error}
          </div>
        )}
      </div>

      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <h4 className="text-sm font-semibold mb-2">💡 How it works:</h4>
        <ul className="text-xs space-y-1 text-gray-600 dark:text-gray-300">
          <li>• Documents are automatically chunked into smaller pieces</li>
          <li>• Each chunk is embedded using OpenAI's text-embedding-3-small</li>
          <li>• Embeddings are stored in PostgreSQL with pgvector</li>
          <li>• Enable RAG in chat to retrieve relevant context automatically</li>
        </ul>
      </div>
    </div>
  );
}

// Simple document list component
export function DocumentList() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/v1/rag/documents', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);
      }
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setLoading(false);
    }
  };

  const deleteDocument = async (documentId: string) => {
    if (!confirm(`Delete document "${documentId}"?`)) return;

    try {
      const token = localStorage.getItem('token');
      await fetch('/v1/rag/document', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ documentId }),
      });
      
      await loadDocuments(); // Refresh list
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">My Documents</h3>
        <button
          onClick={loadDocuments}
          disabled={loading}
          className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded"
        >
          {loading ? '⏳' : '🔄'} Refresh
        </button>
      </div>

      {documents.length === 0 ? (
        <p className="text-gray-500 text-sm">No documents uploaded yet</p>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex justify-between items-center p-3 border rounded-lg"
            >
              <div>
                <div className="font-medium">{doc.id}</div>
                <div className="text-xs text-gray-500">
                  {doc.chunks} chunks • Uploaded {new Date(doc.createdAt).toLocaleDateString()}
                </div>
              </div>
              <button
                onClick={() => deleteDocument(doc.id)}
                className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
              >
                🗑️ Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
