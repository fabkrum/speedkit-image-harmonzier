import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { EmployeeImage, Base64Image } from './types';
import { convertImageToBase64 } from './utils/fileUtils';
import { generateMasterBackground, processHeadshot } from './services/geminiService';
import ImageUploader from './components/ImageUploader';
import ImageCard from './components/ImageCard';
import Spinner from './components/Spinner';
import { UploadIcon, DownloadIcon, TrashIcon, ImageIcon, CheckCircleIcon } from './components/icons';

// Declare global variables from CDN scripts
declare var JSZip: any;
declare var saveAs: any;

type AppState = 'needs_logo' | 'needs_photos' | 'processing_photos' | 'idle';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('needs_logo');
  const [masterBackground, setMasterBackground] = useState<Base64Image | null>(null);
  const [companyLogo, setCompanyLogo] = useState<Base64Image | null>(null);
  const [employeeImages, setEmployeeImages] = useState<EmployeeImage[]>([]);

  const handleLogoUpload = async (files: FileList) => {
    if (files.length === 0) return;
    try {
      const logoBase64 = await convertImageToBase64(files[0], { cropToSquare: false });
      setCompanyLogo(logoBase64);
      setAppState('needs_photos');
    } catch (error) {
      console.error("Error converting logo:", error);
      // You might want to show an error to the user here
    }
  };
  
  const companyLogoUrl = useMemo(() => {
    if (!companyLogo) return null;
    return `data:${companyLogo.mimeType};base64,${companyLogo.base64}`;
  }, [companyLogo]);

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
    if (!companyLogo) return;

    const imagesToProcess = employeeImages.filter(img => img.status === 'pending');
    if (imagesToProcess.length === 0) return;

    setAppState('processing_photos');

    setEmployeeImages(prev =>
      prev.map(img =>
        imagesToProcess.some(p => p.id === img.id)
          ? { ...img, status: 'processing' as const }
          : img
      )
    );

    let currentMasterBackground = masterBackground;

    try {
      // Step 1: Generate background if it doesn't exist
      if (!currentMasterBackground) {
        try {
          const bgDataUrl = await generateMasterBackground();
          const base64 = bgDataUrl.split(',')[1];
          currentMasterBackground = { base64, mimeType: 'image/png' };
          setMasterBackground(currentMasterBackground);
        } catch (error) {
          // If background generation fails, fail all pending images
          const errorMessage = error instanceof Error ? error.message : 'Master background generation failed.';
          setEmployeeImages(prev =>
            prev.map(img =>
              imagesToProcess.some(p => p.id === img.id)
                ? { ...img, status: 'error', error: errorMessage }
                : img
            )
          );
          setAppState('idle');
          return; // Exit
        }
      }
      
      // Step 2: Process all pending images with the guaranteed background
      const processingPromises = imagesToProcess.map(async (image) => {
        try {
          const employeeImageBase64 = await convertImageToBase64(image.file, { cropToSquare: true });
          const processedImageUrl = await processHeadshot(employeeImageBase64, currentMasterBackground!, companyLogo);
          return { id: image.id, status: 'done' as const, url: processedImageUrl };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown processing error.';
          return { id: image.id, status: 'error' as const, error: errorMessage };
        }
      });

      const results = await Promise.allSettled(processingPromises);

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
      setEmployeeImages(prev =>
        prev.map(img => img.status === 'processing' ? { ...img, status: 'error', error: 'Processing failed.' } : img)
      );
    } finally {
      setAppState('idle');
    }
  }, [employeeImages, masterBackground, companyLogo]);

  useEffect(() => {
    const hasPendingImages = employeeImages.some(img => img.status === 'pending');
    if (hasPendingImages && appState !== 'processing_photos') {
      processPendingImages();
    }
  }, [employeeImages, appState, processPendingImages]);

  const [isZipping, setIsZipping] = useState(false);
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
    // Keep background and logo, just reset the employee images
    if (companyLogo) {
      setAppState('needs_photos');
    } else {
      setAppState('needs_logo');
    }
  };

  const processedCount = useMemo(() => employeeImages.filter(img => img.status === 'done').length, [employeeImages]);
  const isProcessingPhotos = appState === 'processing_photos';

  const renderStep = (step: number, title: string, isComplete: boolean, isActive: boolean, content: React.ReactNode) => (
    <div className="p-6 bg-white rounded-xl shadow-md">
      <div className="flex items-center gap-3 border-b-2 border-slate-200 pb-3 mb-4">
        {isComplete ? (
           <CheckCircleIcon className="h-7 w-7 text-green-500" />
        ) : (
          <div className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-white ${isActive ? 'bg-indigo-500' : 'bg-slate-300'}`}>
            {step}
          </div>
        )}
        <h2 className={`text-xl font-semibold ${isComplete ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{title}</h2>
      </div>
      {content}
    </div>
  );
  
  const logoStepActive = appState === 'needs_logo' || !!companyLogo;
  const photosStepActive = !!companyLogo && (appState === 'needs_photos' || appState === 'processing_photos' || appState === 'idle');


  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <h1 className="text-2xl font-bold text-slate-800">Company Headshot Harmonizer</h1>
        </div>
      </header>

      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="space-y-8">
          {renderStep(1, "Upload Company Logo", !!companyLogo, logoStepActive, (
            <>
              <ImageUploader 
                id="logo-uploader"
                onFilesSelected={handleLogoUpload} 
                title={companyLogo ? "Click to replace logo" : "Click to upload logo"}
                subtitle="The logo will be placed on the t-shirt."
                icon={<ImageIcon />}
                disabled={isProcessingPhotos}
              />
              {companyLogoUrl && (
                <div className="mt-6">
                    <p className="text-sm font-medium text-slate-600 mb-2">Current Logo:</p>
                    <div className="flex justify-center p-4 bg-slate-100 rounded-lg border border-slate-200">
                        <img src={companyLogoUrl} alt="Company Logo Preview" className="max-h-24 object-contain" />
                    </div>
                </div>
              )}
            </>
          ))}
          
          {renderStep(2, "Review & Download", employeeImages.length > 0, photosStepActive, (
            <>
              <ImageUploader 
                id="employee-uploader"
                onFilesSelected={handleEmployeesUpload} 
                multiple 
                title="Click to upload or drag & drop"
                subtitle="Processing will start automatically."
                icon={<UploadIcon />}
                disabled={!companyLogo || isProcessingPhotos}
              />
              {employeeImages.length > 0 && (
                <div className="mt-8">
                    <div className="flex flex-wrap items-center gap-4 mb-6">
                        <button 
                            onClick={handleDownloadZip} 
                            disabled={processedCount === 0 || isProcessingPhotos || isZipping}
                            className="flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 disabled:scale-100"
                            aria-label={`Download ${processedCount} processed images as a .zip file`}
                        >
                            {isZipping ? <><Spinner className="h-5 w-5" /> Zipping...</> : <><DownloadIcon className="h-5 w-5" /> Download {processedCount > 0 ? `${processedCount} ` : ''}Image{processedCount !== 1 ? 's' : ''} (.zip)</>}
                        </button>
                        <button 
                            onClick={handleReset} 
                            disabled={isProcessingPhotos}
                            className="flex items-center justify-center gap-2 px-6 py-3 bg-red-500 text-white font-semibold rounded-lg shadow-md hover:bg-red-600 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all duration-300"
                            aria-label="Remove all images and reset the application"
                        >
                            <TrashIcon className="h-5 w-5" /> Reset
                        </button>
                        {isProcessingPhotos && (
                            <div className="flex items-center gap-2 text-slate-500 font-medium">
                                <Spinner className="h-5 w-5" />
                                <span>Harmonizing {employeeImages.filter(i => i.status === 'processing').length} image(s)...</span>
                            </div>
                        )}
                    </div>
    
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {employeeImages.map((image) => (
                            <ImageCard key={image.id} image={image} />
                        ))}
                    </div>
                </div>
              )}
            </>
          ))}
        </div>
      </main>
    </div>
  );
};

export default App;