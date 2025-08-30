import React, { useState, Fragment, useCallback } from 'react';
import { Icons } from '../constants';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', size = 'md', className = '', ...props }) => {
  const baseClasses = 'font-bold rounded-lg transition duration-300 ease-in-out transform hover:scale-105 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed';
  const sizeClasses = {
      sm: 'py-1 px-2 text-xs',
      md: 'py-2 px-4',
      lg: 'px-8 py-3 text-lg',
  };
  const variantClasses = {
    primary: 'bg-indigo-600 hover:bg-indigo-500 text-white',
    secondary: 'bg-slate-700 hover:bg-slate-600 text-slate-100',
    danger: 'bg-red-600 hover:bg-red-500 text-white',
  };
  return (
    <button className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input: React.FC<InputProps> = ({ label, id, ...props }) => (
  <div>
    {label && <label htmlFor={id} className="block text-sm font-medium text-slate-300 mb-1">{label}</label>}
    <input id={id} className="w-full bg-slate-800 border border-slate-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" {...props} />
  </div>
);

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label: string;
    children: React.ReactNode;
}

export const Select: React.FC<SelectProps> = ({ label, id, children, ...props }) => (
    <div className="w-full">
        <label htmlFor={id} className="block text-sm font-medium text-slate-300 mb-1">{label}</label>
        <select id={id} className="w-full bg-slate-800 border border-slate-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" {...props}>
            {children}
        </select>
    </div>
);


interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
}

export const Textarea: React.FC<TextareaProps> = ({ label, id, ...props }) => (
    <div className="w-full">
        <label htmlFor={id} className="block text-sm font-medium text-slate-300 mb-1">{label}</label>
        <textarea id={id} rows={4} className="w-full bg-slate-800 border border-slate-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" {...props} />
    </div>
);

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 transition-opacity" onClick={onClose}>
            <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg border border-slate-700 m-4 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-6 pb-4 flex-shrink-0">
                    <h2 className="text-2xl font-orbitron font-bold text-white">{title}</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors text-3xl leading-none">&times;</button>
                </div>
                <div className="overflow-y-auto px-6 pb-6">
                    {children}
                </div>
            </div>
        </div>
    );
};

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ children, className = '', ...props }) => (
    <div {...props} className={`bg-slate-800/50 backdrop-blur-md border border-slate-700 rounded-lg shadow-lg p-6 ${className}`}>
        {children}
    </div>
);

interface PasswordAuthProps {
  onSuccess: (password: string) => void;
  onCancel: () => void;
  title: string;
  description: string;
  error?: string;
}

export const PasswordAuth: React.FC<PasswordAuthProps> = ({ onSuccess, onCancel, title, description, error }) => {
    const [password, setPassword] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSuccess(password);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
            <Card className="w-full max-w-md">
                <form onSubmit={handleSubmit}>
                    <h2 className="text-2xl font-orbitron font-bold text-center mb-2">{title}</h2>
                    <p className="text-slate-400 text-center mb-6">{description}</p>
                    {error && <p className="text-red-400 text-center mb-4">{error}</p>}
                    <div className="mb-4">
                        <Input 
                            label="Password" 
                            id="password-auth" 
                            type="password" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <div className="flex justify-end gap-4">
                        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
                        <Button type="submit" variant="primary">
                            <Icons.Lock className="w-4 h-4" />
                            Authenticate
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
}

export const ImageUploader: React.FC<{
  onImageUploaded: (base64: string) => void;
  label: string;
  className?: string;
}> = ({ onImageUploaded, label, className = '' }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback((file: File) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if(e.target?.result) {
            onImageUploaded(e.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    } else {
      alert('Please upload a valid image file.');
    }
  }, [onImageUploaded]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, [handleFile]);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const uniqueId = `file-upload-${label.replace(/\s+/g, '-')}`;

  return (
    <div className={`w-full ${className}`}>
      <label className="block text-sm font-medium text-slate-300 mb-1">{label}</label>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative block w-full border-2 border-dashed rounded-lg p-6 text-center hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors ${isDragging ? 'border-indigo-500 bg-slate-700/50' : 'border-slate-600'}`}
      >
        <svg className="mx-auto h-12 w-12 text-slate-500" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
          <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="mt-2 block text-sm font-medium text-slate-400">
          Drag & drop a file or{' '}
          <label htmlFor={uniqueId} className="cursor-pointer font-semibold text-indigo-400 hover:text-indigo-300">
            browse
          </label>
        </span>
        <input id={uniqueId} name={uniqueId} type="file" className="sr-only" onChange={handleFileChange} accept="image/*" />
      </div>
    </div>
  );
};

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'primary' | 'secondary' | 'danger';
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = 'Confirm', 
  cancelText = 'Cancel', 
  confirmVariant = 'primary' 
}) => {
    if (!isOpen) return null;

    const handleConfirm = () => {
        onConfirm();
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <div className="space-y-6">
                <div className="text-slate-300">{message}</div>
                <div className="flex justify-end gap-4">
                    <Button variant="secondary" onClick={onClose}>{cancelText}</Button>
                    <Button variant={confirmVariant} onClick={handleConfirm}>{confirmText}</Button>
                </div>
            </div>
        </Modal>
    );
};