import React from 'react';
import { EmployeeImage } from '../types';
import Spinner from './Spinner';
// Fix: Imported SparklesIcon to resolve a reference error.
import { CheckCircleIcon, XCircleIcon, SparklesIcon } from './icons';

interface ImageCardProps {
  image: EmployeeImage;
}

const StatusOverlay: React.FC<{ status: EmployeeImage['status'], error?: string }> = ({ status, error }) => {
  if (status === 'processing') {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-60 rounded-lg">
        <Spinner className="h-10 w-10 text-white" />
        <p className="mt-2 text-sm text-white">Harmonizing...</p>
      </div>
    );
  }
  if (status === 'done') {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-green-500 bg-opacity-70 rounded-lg">
        <CheckCircleIcon className="h-12 w-12 text-white" />
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-500 bg-opacity-70 rounded-lg p-2 text-center">
        <XCircleIcon className="h-12 w-12 text-white" />
        <p className="mt-2 text-xs text-white font-semibold">{error || 'An error occurred'}</p>
      </div>
    );
  }
  return null;
};


const ImageCard: React.FC<ImageCardProps> = ({ image }) => {
  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-lg transition-all duration-300 hover:shadow-2xl hover:-translate-y-1">
      <div className="grid grid-cols-2 gap-px">
        <div className="relative">
          <img src={image.originalUrl} alt={image.file.name} className="aspect-square w-full h-full object-cover" />
          <div className="absolute bottom-0 w-full bg-black bg-opacity-50 px-2 py-1">
            <p className="text-xs text-white font-semibold truncate">Original</p>
          </div>
        </div>
        <div className="relative bg-slate-200">
            {image.processedUrl ? (
                <img src={image.processedUrl} alt={`Processed ${image.file.name}`} className="aspect-square w-full h-full object-cover" />
            ) : (
                <div className="aspect-square w-full h-full flex items-center justify-center bg-slate-100">
                    <SparklesIcon className="h-12 w-12 text-slate-300" />
                </div>
            )}
            <div className="absolute bottom-0 w-full bg-black bg-opacity-50 px-2 py-1">
                <p className="text-xs text-white font-semibold truncate">Harmonized</p>
            </div>
            <StatusOverlay status={image.status} error={image.error}/>
        </div>
      </div>
       <div className="bg-white p-3">
        <p className="truncate text-sm font-medium text-slate-800" title={image.file.name}>
          {image.file.name}
        </p>
      </div>
    </div>
  );
};

export default ImageCard;