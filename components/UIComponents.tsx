import React from 'react';
import { ChevronDown, Upload } from 'lucide-react';

interface LabelProps {
  children: React.ReactNode;
  htmlFor?: string;
}

export const Label: React.FC<LabelProps> = ({ children, htmlFor }) => (
  <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-300 mb-1.5">
    {children}
  </label>
);

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: { value: string; label: string }[];
}

export const SelectInput: React.FC<SelectProps> = ({ label, options, className, ...props }) => (
  <div className="w-full">
    <Label htmlFor={props.id}>{label}</Label>
    <div className="relative">
      <select
        className={`w-full appearance-none bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all cursor-pointer hover:bg-slate-800 ${className}`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
    </div>
  </div>
);

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export const TextInput: React.FC<TextInputProps> = ({ label, className, ...props }) => (
  <div className="w-full">
    <Label htmlFor={props.id}>{label}</Label>
    <input
      type="text"
      className={`w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all placeholder-slate-500 ${className}`}
      {...props}
    />
  </div>
);

interface FileInputProps {
  label: string;
  onChange: (file: File | null) => void;
  selectedFile: File | null;
  accept?: string;
}

export const FileInput: React.FC<FileInputProps> = ({ label, onChange, selectedFile, accept = "image/*" }) => (
  <div className="w-full">
    <Label>{label}</Label>
    <div className="relative group">
      <input
        type="file"
        accept={accept}
        onChange={(e) => {
            const file = e.target.files ? e.target.files[0] : null;
            onChange(file);
        }}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
      />
      <div className={`border-2 border-dashed rounded-lg p-3 flex items-center justify-center transition-all ${selectedFile ? 'border-purple-500 bg-purple-500/10' : 'border-slate-700 hover:border-slate-500 bg-slate-800/30'}`}>
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="p-2 bg-slate-800 rounded-full shrink-0">
             <Upload className="w-4 h-4 text-purple-400" />
          </div>
          <span className="text-sm truncate text-slate-300">
            {selectedFile ? selectedFile.name : "点击上传图片"}
          </span>
        </div>
      </div>
    </div>
  </div>
);
