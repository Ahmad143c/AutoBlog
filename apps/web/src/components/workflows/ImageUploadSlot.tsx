import { useRef } from "react"
import { Upload } from "lucide-react"

interface ImageUploadSlotProps {
  preview: string
  onSelect: (file: File) => void
  size?: number  // default 52
  inputId?: string
}

export function ImageUploadSlot({ preview, onSelect, size = 52, inputId }: ImageUploadSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  
  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        className="relative border-2 border-dashed border-gray-200 rounded-lg 
                   cursor-pointer hover:border-purple-400 hover:bg-purple-50 
                   transition-all flex items-center justify-center overflow-hidden"
        style={{ width: size, height: size }}
      >
        {preview ? (
          <>
            <img src={preview} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-40 
                           transition-all flex items-center justify-center group">
              <span className="text-white text-[10px] font-medium opacity-0 group-hover:opacity-100">
                Change
              </span>
            </div>
          </>
        ) : (
          <div className="text-center p-1">
            <Upload className="w-4 h-4 text-gray-300 mx-auto" />
            <span className="text-[10px] text-gray-300 mt-0.5 block">Upload</span>
          </div>
        )}
      </div>
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onSelect(f)
        }}
      />
    </div>
  )
}
