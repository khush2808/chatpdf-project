"use client";
import React, { useState, useEffect } from "react";
import { FileText, Download, Eye, AlertCircle, Loader2 } from "lucide-react";

type Props = {
  pdf_url: string;
  pdf_name?: string;
};

const PDFViewer = ({ pdf_url, pdf_name }: Props) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [viewerType, setViewerType] = useState<'google' | 'direct' | 'fallback'>('google');

  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
  }, [pdf_url]);

  const handleLoad = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
    
    // Try fallback viewer
    if (viewerType === 'google') {
      setViewerType('direct');
    } else if (viewerType === 'direct') {
      setViewerType('fallback');
    }
  };

  const downloadPDF = () => {
    const link = document.createElement('a');
    link.href = pdf_url;
    link.download = pdf_name || 'document.pdf';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderViewer = () => {
    switch (viewerType) {
      case 'google':
        return (
          <iframe
            src={`https://docs.google.com/gview?url=${encodeURIComponent(pdf_url)}&embedded=true`}
            className="w-full h-full border-0"
            onLoad={handleLoad}
            onError={handleError}
            title="PDF Viewer"
          />
        );
      
      case 'direct':
        return (
          <iframe
            src={pdf_url}
            className="w-full h-full border-0"
            onLoad={handleLoad}
            onError={handleError}
            title="PDF Viewer"
          />
        );
      
      case 'fallback':
        return (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 p-8">
            <FileText className="w-16 h-16 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              PDF Viewer Unavailable
            </h3>
            <p className="text-gray-600 text-center mb-6 max-w-md">
              The PDF viewer is not available in your browser. You can download the file to view it locally.
            </p>
            <div className="flex gap-3">
              <button
                onClick={downloadPDF}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
              <button
                onClick={() => window.open(pdf_url, '_blank')}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <Eye className="w-4 h-4" />
                Open in New Tab
              </button>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  if (hasError && viewerType === 'fallback') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 p-8">
        <AlertCircle className="w-16 h-16 text-red-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Unable to Load PDF
        </h3>
        <p className="text-gray-600 text-center mb-6 max-w-md">
          We couldn't load the PDF file. This might be due to browser restrictions or network issues.
        </p>
        <div className="flex gap-3">
          <button
            onClick={downloadPDF}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </button>
          <button
            onClick={() => window.open(pdf_url, '_blank')}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Eye className="w-4 h-4" />
            Open in New Tab
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 z-10">
          <div className="flex flex-col items-center">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
            <p className="text-sm text-gray-600">
              Loading PDF...
            </p>
          </div>
        </div>
      )}
      
      {renderViewer()}
      
      {/* Download button overlay */}
      <div className="absolute top-4 right-4 z-20">
        <button
          onClick={downloadPDF}
          className="flex items-center gap-2 px-3 py-2 bg-white bg-opacity-90 backdrop-blur-sm text-gray-700 rounded-lg shadow-lg hover:bg-opacity-100 transition-all"
          title="Download PDF"
        >
          <Download className="w-4 h-4" />
          <span className="text-sm font-medium">Download</span>
        </button>
      </div>
    </div>
  );
};

export default PDFViewer;
