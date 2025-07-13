# ChatPDF - AI-Powered PDF Chat Application

A modern, full-stack application that allows users to upload PDF documents and chat with them using AI. Built with Next.js 15, TypeScript, and powered by OpenAI, Pinecone, and AWS S3.

## 🚀 Features

- **PDF Upload & Processing**: Upload PDF files up to 10MB with real-time processing
- **AI Chat Interface**: Ask questions about your PDF documents and get intelligent responses
- **Vector Search**: Advanced semantic search using Pinecone vector database
- **User Authentication**: Secure authentication with Clerk
- **Real-time Processing**: Live progress indicators and error handling
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Error Recovery**: Comprehensive error handling with retry mechanisms

## 🏗️ Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Authentication**: Clerk
- **Database**: Neon (PostgreSQL) with Drizzle ORM
- **File Storage**: AWS S3
- **Vector Database**: Pinecone
- **AI**: OpenAI GPT-3.5-turbo & text-embedding-3-small
- **State Management**: TanStack Query (React Query)
- **UI Components**: Radix UI, Lucide React Icons

## 📋 Prerequisites

Before you begin, ensure you have the following:

- Node.js 18+ installed
- npm or yarn package manager
- AWS S3 bucket with proper CORS configuration
- Pinecone account and index
- OpenAI API key
- Clerk account
- Neon database

## 🛠️ Installation & Setup

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd chatpdf-project
npm install
```

### 2. Environment Configuration

Copy the `.env.example` file and fill in your credentials:

```bash
cp .env.example .env.local
```

Configure the following environment variables:

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/chat
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/chat

# Database (Neon)
DATABASE_URL=your_neon_database_url

# AWS S3
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=your_aws_region
AWS_S3_BUCKET=your_s3_bucket_name

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Pinecone
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_ENVIRONMENT=your_pinecone_environment
PINECONE_INDEX_NAME=chatpdf
```

### 3. Database Setup

Run the database migrations:

```bash
npm run db:generate
npm run db:push
```

### 4. Pinecone Index Setup

Create a Pinecone index with the following specifications:
- **Dimension**: 1536 (for text-embedding-3-small)
- **Metric**: cosine
- **Name**: chatpdf (or update PINECONE_INDEX_NAME in .env)

### 5. AWS S3 Configuration

Configure your S3 bucket with the following CORS policy:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "POST", "PUT"],
    "AllowedOrigins": ["http://localhost:3000", "https://your-domain.com"],
    "ExposeHeaders": []
  }
]
```

### 6. Start the Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the application.

## 🔧 API Endpoints

### POST /api/create-chat
Creates a new chat session for a PDF file.

**Request Body:**
```json
{
  "file_key": "s3-file-key",
  "file_name": "document.pdf"
}
```

**Response:**
```json
{
  "chat_id": 123,
  "message": "PDF processed and chat created successfully",
  "pages_processed": 5,
  "isExisting": false
}
```

### POST /api/chat
Sends a message to the AI about a specific PDF.

**Request Body:**
```json
{
  "chatId": 123,
  "message": "What is the main topic of this document?"
}
```

**Response:**
```json
{
  "message": "AI response here...",
  "context": "Context found",
  "chatId": 123
}
```

### GET /api/messages/[chatId]
Retrieves all messages for a specific chat.

**Response:**
```json
[
  {
    "id": 1,
    "content": "User message",
    "role": "user",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "chatId": 123
  }
]
```

## 🎯 Usage

1. **Sign Up/In**: Create an account or sign in using Clerk authentication
2. **Upload PDF**: Drag and drop or click to upload a PDF file (max 10MB)
3. **Wait for Processing**: The system will extract text and create vector embeddings
4. **Start Chatting**: Ask questions about your PDF and get AI-powered responses
5. **View PDF**: Use the enhanced PDF viewer with fallback options

## 🐛 Troubleshooting

### Common Issues

**PDF Processing Fails**
- Ensure the PDF is not encrypted or password-protected
- Check that the file size is under 10MB
- Verify OpenAI API key is valid and has sufficient credits

**Vector Database Errors**
- Confirm Pinecone API key and environment are correct
- Ensure the Pinecone index exists and has the correct dimension (1536)
- Check that the index name matches PINECONE_INDEX_NAME

**S3 Upload Issues**
- Verify AWS credentials are correct
- Ensure S3 bucket CORS policy is properly configured
- Check that the bucket name matches AWS_S3_BUCKET

**Database Connection Errors**
- Verify DATABASE_URL is correct and accessible
- Run `npm run db:push` to ensure schema is up to date
- Check that Neon database is active

### Debug Mode

Enable debug logging by setting `NODE_ENV=development` in your environment variables.

## 🔒 Security Features

- **Authentication**: All routes require valid Clerk authentication
- **Authorization**: Users can only access their own chats and files
- **Input Validation**: Comprehensive validation on all API endpoints
- **Error Handling**: Secure error responses without information leakage
- **Rate Limiting**: Built-in protection against abuse

## 🚀 Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy with `npm run build`

### Other Platforms

The application can be deployed to any platform that supports Next.js:
- Netlify
- Railway
- DigitalOcean App Platform
- AWS Amplify

## 📝 Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key | Yes |
| `CLERK_SECRET_KEY` | Clerk secret key | Yes |
| `DATABASE_URL` | Neon database connection string | Yes |
| `AWS_ACCESS_KEY_ID` | AWS access key | Yes |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | Yes |
| `AWS_REGION` | AWS region | Yes |
| `AWS_S3_BUCKET` | S3 bucket name | Yes |
| `OPENAI_API_KEY` | OpenAI API key | Yes |
| `PINECONE_API_KEY` | Pinecone API key | Yes |
| `PINECONE_ENVIRONMENT` | Pinecone environment | Yes |
| `PINECONE_INDEX_NAME` | Pinecone index name | No (defaults to "chatpdf") |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you encounter any issues:

1. Check the troubleshooting section above
2. Review the console logs for error messages
3. Ensure all environment variables are properly configured
4. Create an issue in the GitHub repository

## 🔄 Updates

Stay updated with the latest features and bug fixes by regularly pulling from the main branch:

```bash
git pull origin main
npm install
npm run db:push
```
