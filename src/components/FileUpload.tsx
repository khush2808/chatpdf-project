"use client";
import { uploadToS3 } from "@/lib/s3";
import { useMutation } from "@tanstack/react-query";
import { Inbox, Loader2, FileWarning } from "lucide-react";
import React from "react";
import { useDropzone } from "react-dropzone";
import axios from "axios";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";

type UploadState = "idle" | "uploading" | "processing" | "error";

const FileUpload = () => {
    const router = useRouter();
    const [status, setStatus] = React.useState<UploadState>("idle");
    const [progress, setProgress] = React.useState(0);
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
  });

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    multiple: false,
    onDropRejected: () => {
      toast.error("Only PDF files are allowed and size must be <= 10MB");
    },
    onDrop: async (acceptedFiles) => {
      const file = acceptedFiles[0];
      if (!file) return;

      if (file.size > 10 * 1024 * 1024) {
        toast.error("File too large (max 10MB)");
        return;
      }

      try {
        setStatus("uploading");
        setProgress(0);

        // Currently we don't have granular progress from S3 client in-browser.
        // We present an indeterminate spinner; future enhancement could use
        // multipart upload with progress callbacks.
        const data = await uploadToS3(file);

        if ("error" in data || !data.file_key || !data.file_name) {
          throw new Error("S3 upload failed");
        }

        setStatus("processing");
        mutate(data, {
          onSuccess: ({ chat_id }) => {
            toast.success("Chat created!");
            router.push(`/chat/${chat_id}`);
          },
          onError: (err) => {
            console.error(err);
            toast.error("Error creating chat");
            setStatus("error");
          },
        });
      } catch (error) {
        console.error(error);
        toast.error("File upload failed");
        setStatus("error");
      }
    },
  });

  return (
    <div className="p-2 bg-white rounded-xl">
      <div
        {...getRootProps({
          className:
            "border-dashed border-2 rounded-xl cursor-pointer bg-gray-50 py-8 flex justify-center items-center flex-col",
        })}
      >
        <input {...getInputProps()} />
        {status === "uploading" || status === "processing" ? (
          <>
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
            <p className="mt-2 text-sm text-slate-400">
              {status === "uploading" ? "Uploading..." : "Processing..."}
            </p>
          </>
        ) : (
          <>
            {status === "error" ? (
              <>
                <FileWarning className="w-10 h-10 text-red-500" />
                <p className="mt-2 text-sm text-red-500">Try again</p>
              </>
            ) : (
              <>
                <Inbox
                  className={`w-10 h-10 ${
                    isDragActive ? "text-blue-600" : "text-blue-500"
                  }`}
                />
                <p className="mt-2 text-sm text-slate-400">
                  {isDragActive ? "Drop the files here ..." : "Drop PDF Here"}
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default FileUpload;
