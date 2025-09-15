import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { EmployeeImage } from './types';
import { convertImageToBase64 } from './utils/fileUtils';
import { processImageStyle } from './services/geminiService';
import ImageUploader from './components/ImageUploader';
import ImageCard from './components/ImageCard';
import Spinner from './components/Spinner';
import { UploadIcon, DownloadIcon, TrashIcon } from './components/icons';

// Declare global variables from CDN scripts
declare var JSZip: any;
declare var saveAs: any;

const App: React.FC = () => {
  const [employeeImages, setEmployeeImages] = useState<EmployeeImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isZipping, setIsZipping] = useState(false);

  const handleEmployeesUpload = async (files: FileList) => {
    const newImages = Array.from(files).map((file) => ({
      id: `${file.name}-${file.lastModified}`,
      file,
      originalUrl: URL.createObjectURL(file),
      processedUrl: null,
      status: 'pending' as const,
    }));
    setEmployeeImages((prev) => [...prev, ...newImages]);
  };


  const processPendingImages = useCallback(async () => {
    const imagesToProcess = employeeImages.filter(img => img.status === 'pending');
    if (imagesToProcess.length === 0) return;

    setIsProcessing(true);

    // Set status to 'processing' for the images that are about to be processed.
    setEmployeeImages(prev =>
      prev.map(img =>
        imagesToProcess.some(p => p.id === img.id)
          ? { ...img, status: 'processing' as const }
          : img
      )
    );

    try {
      const processingPromises = imagesToProcess.map(async (image) => {
        try {
          const employeeImageBase64 = await convertImageToBase64(image.file);
          const processedImageUrl = await processImageStyle(employeeImageBase64);
          return { id: image.id, status: 'done' as const, url: processedImageUrl };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown processing error.';
          return { id: image.id, status: 'error' as const, error: errorMessage };
        }
      });

      const results = await Promise.allSettled(processingPromises);

      // Update the state with the results of the image processing.
      setEmployeeImages(prev => {
        const newImages = [...prev];
        results.forEach(result => {
          if (result.status === 'fulfilled') {
            const { id, status, url, error } = result.value;
            const index = newImages.findIndex(img => img.id === id);
            if (index !== -1) {
              newImages[index].status = status;
              if (status === 'done' && url) newImages[index].processedUrl = url;
              if (status === 'error' && error) newImages[index].error = error;
            }
          }
        });
        return newImages;
      });

    } catch (error) {
        console.error("A critical error occurred during image processing:", error);
        // Fallback error for any unhandled exceptions during the process.
        setEmployeeImages(prev =>
            prev.map(img => img.status === 'processing' ? { ...img, status: 'error', error: 'Processing failed.' } : img)
        );
    } finally {
      setIsProcessing(false);
    }
  }, [employeeImages]);

  // This effect hook triggers the image processing when new photos are uploaded.
  useEffect(() => {
    const hasPendingImages = employeeImages.some(img => img.status === 'pending');
    if (hasPendingImages && !isProcessing) {
        processPendingImages();
    }
  }, [employeeImages, isProcessing, processPendingImages]);


  const handleDownloadZip = async () => {
    const processedImages = employeeImages.filter(img => img.status === 'done' && img.processedUrl);
    if (processedImages.length === 0) return;

    setIsZipping(true);
    try {
      const zip = new JSZip();
      
      const getPngFilename = (originalFilename: string) => {
        const lastDotIndex = originalFilename.lastIndexOf('.');
        if (lastDotIndex === -1) return `${originalFilename}.png`;
        return `${originalFilename.substring(0, lastDotIndex)}.png`;
      };

      for (const image of processedImages) {
        const response = await fetch(image.processedUrl!);
        const blob = await response.blob();
        const newFilename = getPngFilename(image.file.name);
        zip.file(newFilename, blob);
      }
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, 'harmonized-headshots.zip');
    } catch (error) {
        console.error("Error creating ZIP file", error);
    } finally {
        setIsZipping(false);
    }
  };

  const handleReset = () => {
    setEmployeeImages([]);
  }
  
  const processedCount = useMemo(() => employeeImages.filter(img => img.status === 'done').length, [employeeImages]);
  const isIdle = !isProcessing && !isZipping;
  const canReset = employeeImages.length > 0;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <header className="bg-white shadow-sm">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Corporate Headshot Harmonizer</h1>
              <p className="text-slate-500 mt-1">Create consistent, professional headshots for your entire team.</p>
          </div>
      </header>

      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="space-y-8">
          
          <div className="p-6 bg-white rounded-xl shadow-md">
            <h2 className="text-xl font-semibold text-slate-700 border-b-2 border-indigo-200 pb-2 mb-4">1. Upload Employee Photos</h2>
            <ImageUploader 
              id="employee-uploader"
              onFilesSelected={handleEmployeesUpload} 
              multiple 
              title="Click to upload or drag & drop"
              subtitle="Processing will start automatically after upload."
              icon={<UploadIcon />}
              disabled={isProcessing}
            />
          </div>

          <div className="bg-white p-6 rounded-xl shadow-md">
            <h2 className="text-xl font-semibold text-slate-700 border-b-2 border-indigo-200 pb-2 mb-4">2. Download Results</h2>
            <div className="flex flex-wrap items-center gap-4">
                <button 
                    onClick={handleDownloadZip} 
                    disabled={processedCount === 0 || !isIdle}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 disabled:scale-100"
                >
                    {isZipping ? <><Spinner className="h-5 w-5" /> Zipping...</> : <><DownloadIcon className="h-5 w-5" /> Download {processedCount > 0 ? `${processedCount} ` : ''}Image{processedCount !== 1 ? 's' : ''} (.zip)</>}
                </button>
                 <button 
                    onClick={handleReset} 
                    disabled={!canReset || !isIdle}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-red-500 text-white font-semibold rounded-lg shadow-md hover:bg-red-600 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all duration-300"
                >
                    <TrashIcon className="h-5 w-5" /> Reset
                </button>
                {isProcessing && (
                    <div className="flex items-center gap-2 text-slate-500 font-medium">
                        <Spinner className="h-5 w-5" />
                        <span>Harmonizing {employeeImages.filter(i => i.status === 'processing').length} image(s)...</span>
                    </div>
                )}
            </div>
          </div>
        </div>
        
        {employeeImages.length > 0 ? (
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {employeeImages.map((image) => (
                    <ImageCard key={image.id} image={image} />
                ))}
            </div>
        ) : (
            <div className="mt-8 text-center py-16 border-2 border-dashed border-slate-300 rounded-xl bg-white">
                <UploadIcon className="mx-auto h-16 w-16 text-slate-300" />
                <h3 className="mt-2 text-lg font-medium text-slate-800">Ready for employee photos</h3>
                <p className="mt-1 text-sm text-slate-500">Upload your team's headshots to get started.</p>
            </div>
        )}
      </main>
    </div>
  );
};

export default App;