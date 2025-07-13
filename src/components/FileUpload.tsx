"use client";
import { uploadToS3 } from "@/lib/s3";
import { useMutation } from "@tanstack/react-query";
import { Inbox, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import React from "react";
import { useDropzone } from "react-dropzone";
import axios from "axios";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import { validatePDFFile } from "@/lib/pdf-processor";

interface UploadState {
  isUploading: boolean;
  isProcessing: boolean;
  progress: number;
  error: string | null;
}

const FileUpload = () => {
  const router = useRouter();
  const [uploadState, setUploadState] = React.useState<UploadState>({
    isUploading: false,
    isProcessing: false,
    progress: 0,
    error: null,
  });

  const { mutate, isPending } = useMutation({
    mutationFn: async ({
      file_key,
      file_name,
    }: {
      file_key: string;
      file_name: string;
    }) => {
      const response = await axios.post("/api/create-chat", {
        file_key,
        file_name,
      });
      return response.data;
    },
    onSuccess: (data: any) => {
      setUploadState((prev: UploadState) => ({ ...prev, isProcessing: false, error: null }));
      
      if (data.isExisting) {
        toast.success("Chat already exists for this file!");
      } else {
        toast.success(`PDF processed successfully! ${data.pages_processed} pages analyzed.`);
      }
      
      router.push(`/chat/${data.chat_id}`);
    },
    onError: (error: any) => {
      setUploadState((prev: UploadState) => ({ 
        ...prev, 
        isProcessing: false, 
        error: error.response?.data?.error || "Failed to process PDF" 
      }));
      
      const errorMessage = error.response?.data?.error || "Error creating chat";
      toast.error(errorMessage);
      console.error("Chat creation error:", error);
    },
  });

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    disabled: uploadState.isUploading || uploadState.isProcessing || isPending,
    onDrop: async (acceptedFiles: File[], rejectedFiles: any[]) => {
      // Handle rejected files
      if (rejectedFiles.length > 0) {
        const rejection = rejectedFiles[0];
        let errorMessage = "File upload failed";
        
        if (rejection.errors) {
          const error = rejection.errors[0];
          if (error.code === "file-invalid-type") {
            errorMessage = "Please upload a PDF file";
          } else if (error.code === "file-too-large") {
            errorMessage = "File size must be less than 10MB";
          } else if (error.code === "too-many-files") {
            errorMessage = "Please upload only one file";
          }
        }
        
        toast.error(errorMessage);
        return;
      }

      const file = acceptedFiles[0];
      if (!file) {
        toast.error("No file selected");
        return;
      }

      // Validate file
      const validation = validatePDFFile(file);
      if (!validation.isValid) {
        toast.error(validation.error || "Invalid file");
        return;
      }

      try {
        setUploadState({
          isUploading: true,
          isProcessing: false,
          progress: 0,
          error: null,
        });

        // Simulate upload progress
        const progressInterval = setInterval(() => {
          setUploadState((prev: UploadState) => ({
            ...prev,
            progress: Math.min(prev.progress + 10, 90)
          }));
        }, 200);

        console.log("Uploading file:", file.name);
        const data = await uploadToS3(file);
        
        clearInterval(progressInterval);
        setUploadState((prev: UploadState) => ({ ...prev, isUploading: false, progress: 100 }));

        console.log("Upload successful:", data);

        if ("error" in data || !data.file_key || !data.file_name) {
          throw new Error(data.error || "Upload failed");
        }

        // Start processing phase
        setUploadState((prev: UploadState) => ({ 
          ...prev, 
          isProcessing: true, 
          progress: 100 
        }));

        mutate(data, {
          onSuccess: (responseData: any) => {
            setUploadState((prev: UploadState) => ({ 
              ...prev, 
              isProcessing: false, 
              error: null 
            }));
            
            if (responseData.isExisting) {
              toast.success("Chat already exists for this file!");
            } else {
              toast.success(`PDF processed successfully! ${responseData.pages_processed} pages analyzed.`);
            }
            
            router.push(`/chat/${responseData.chat_id}`);
          },
          onError: (error: any) => {
            setUploadState((prev: UploadState) => ({ 
              ...prev, 
              isProcessing: false, 
              error: error.response?.data?.error || "Failed to process PDF" 
            }));
            
            const errorMessage = error.response?.data?.error || "Error creating chat";
            toast.error(errorMessage);
            console.error("Chat creation error:", error);
          },
        });

      } catch (error) {
        // Note: progressInterval is not accessible here, but that's okay since it's cleared above
        setUploadState({
          isUploading: false,
          isProcessing: false,
          progress: 0,
          error: error instanceof Error ? error.message : "Upload failed",
        });
        
        toast.error(error instanceof Error ? error.message : "Upload failed");
        console.error("Upload error:", error);
      }
    },
  });

  const isProcessing = uploadState.isUploading || uploadState.isProcessing || isPending;

  return (
    <div className="p-2 bg-white rounded-xl">
      <div
        {...getRootProps({
          className: `
            border-dashed border-2 rounded-xl cursor-pointer bg-gray-50 py-8 
            flex justify-center items-center flex-col transition-all duration-200
            ${isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300'}
            ${isProcessing ? 'cursor-not-allowed opacity-75' : 'hover:border-blue-400 hover:bg-blue-50'}
          `,
        })}
      >
        <input {...getInputProps()} />
        
        {uploadState.error ? (
          <>
            <AlertCircle className="w-10 h-10 text-red-500" />
            <p className="mt-2 text-sm text-red-600 font-medium">Upload Failed</p>
            <p className="mt-1 text-xs text-red-500">{uploadState.error}</p>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setUploadState({
                  isUploading: false,
                  isProcessing: false,
                  progress: 0,
                  error: null,
                });
              }}
              className="mt-2 px-3 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200"
            >
              Try Again
            </button>
          </>
        ) : uploadState.isUploading ? (
          <>
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
            <p className="mt-2 text-sm text-slate-600 font-medium">Uploading PDF...</p>
            <div className="w-48 h-2 bg-gray-200 rounded-full mt-2">
              <div 
                className="h-2 bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${uploadState.progress}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">{uploadState.progress}%</p>
          </>
        ) : uploadState.isProcessing ? (
          <>
            <Loader2 className="w-10 h-10 text-green-500 animate-spin" />
            <p className="mt-2 text-sm text-slate-600 font-medium">Processing PDF...</p>
            <p className="mt-1 text-xs text-slate-500">Extracting text and creating vectors</p>
          </>
        ) : (
          <>
            <Inbox className="w-10 h-10 text-blue-500" />
            <p className="mt-2 text-sm text-slate-600 font-medium">
              {isDragActive ? "Drop PDF here" : "Drop PDF Here"}
            </p>
            <p className="mt-1 text-xs text-slate-500">or click to browse</p>
            <p className="mt-1 text-xs text-slate-400">Max 10MB</p>
          </>
        )}
      </div>
    </div>
  );
};

export default FileUpload;
