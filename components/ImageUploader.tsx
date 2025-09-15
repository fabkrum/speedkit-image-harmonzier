import React, { useRef } from 'react';

interface ImageUploaderProps {
  onFilesSelected: (files: FileList) => void;
  multiple?: boolean;
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactElement<{ className?: string }>;
  disabled?: boolean;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ onFilesSelected, multiple = false, id, title, subtitle, icon, disabled = false }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      onFilesSelected(event.target.files);
      event.target.value = ''; // Reset input to allow re-uploading the same file
    }
  };

  const handleClick = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  return (
    <div
      onClick={handleClick}
      className={`group relative flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-all duration-300 ${
        disabled
          ? 'cursor-not-allowed border-slate-200 bg-slate-50'
          : 'cursor-pointer border-slate-300 bg-white hover:border-indigo-500 hover:bg-indigo-50'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        id={id}
        multiple={multiple}
        accept="image/png, image/jpeg, image/webp, image/avif"
        onChange={handleFileChange}
        className="sr-only"
        disabled={disabled}
      />
      <div className={`transition-colors duration-300 ${
          disabled ? 'text-slate-300' : 'text-slate-400 group-hover:text-indigo-500'
      }`}>
        {React.cloneElement(icon, { className: "h-12 w-12" })}
      </div>
      <p className={`mt-4 text-lg font-semibold ${disabled ? 'text-slate-400' : 'text-slate-700'}`}>{title}</p>
      <p className={`text-sm ${disabled ? 'text-slate-400' : 'text-slate-500'}`}>{subtitle}</p>
    </div>
  );
};

export default ImageUploader;
