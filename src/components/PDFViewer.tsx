"use client";
import React, { useEffect, useRef, useState } from "react";

type Props = {
  pdf_url: string;
};

const PDFViewer = ({ pdf_url }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pageNum, setPageNum] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.2);

  useEffect(() => {
    let pdfDoc: any;

    async function render() {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      // Worker
      pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

      pdfDoc = await pdfjs.getDocument({ url: pdf_url }).promise;
      setTotalPages(pdfDoc.numPages);
      const page = await pdfDoc.getPage(pageNum);

      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: ctx!,
        viewport,
      };
      await page.render(renderContext).promise;
    }

    render();

    return () => {
      pdfDoc = null;
    };
  }, [pdf_url, pageNum, scale]);

  const zoomIn = () => setScale((s) => Math.min(s + 0.2, 3));
  const zoomOut = () => setScale((s) => Math.max(s - 0.2, 0.6));

  const nextPage = () => setPageNum((n) => Math.min(n + 1, totalPages));
  const prevPage = () => setPageNum((n) => Math.max(n - 1, 1));

  return (
    <div className="w-full h-full flex flex-col items-center">
      <div className="flex gap-2 items-center mb-2">
        <button onClick={prevPage} disabled={pageNum === 1} className="px-2 py-1 border rounded">
          Prev
        </button>
        <span>
          {pageNum} / {totalPages || "-"}
        </span>
        <button onClick={nextPage} disabled={pageNum === totalPages} className="px-2 py-1 border rounded">
          Next
        </button>
        <button onClick={zoomOut} className="px-2 py-1 border rounded">
          -
        </button>
        <button onClick={zoomIn} className="px-2 py-1 border rounded">
          +
        </button>
      </div>
      <canvas ref={canvasRef} className="border shadow" />
    </div>
  );
};

export default PDFViewer;
