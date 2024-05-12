import React, { useCallback, useMemo } from 'react'
import { useDropzone, Accept } from 'react-dropzone'
import { cn } from '@/lib/utils'

const baseStyle = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  borderWidth: 2,
  borderStyle: 'dashed',
  outline: 'none',
  transition: 'border .24s ease-in-out',
}

const focusedStyle = {
  borderColor: 'hsl(var(--nextui-primary))',
}

const acceptStyle = {
  borderColor: 'hsl(var(--nextui-success))',
}

const rejectStyle = {
  borderColor: 'hsl(var(--nextui-danger))',
}

interface MyDropzoneProps {
  accept: any
  nonActiveStr: string
  fileLoadCallback: (fileContents: File) => void
  required?: boolean
  className?: React.ComponentProps<'div'>['className']
}

export default function MyDropzone({
  accept,
  nonActiveStr,
  fileLoadCallback,
  required, // Add this line
  className,
}: MyDropzoneProps) {
  // Update this line
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      acceptedFiles.forEach((file) => {
        fileLoadCallback(file)
      })
    },
    [fileLoadCallback]
  ) // Add fileLoadCallback to the dependency array

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragAccept,
    isDragReject,
    isFocused,
  } = useDropzone({ onDrop, ...accept })

  const style = useMemo(
    () => ({
      ...baseStyle,
      ...(isFocused ? focusedStyle : {}),
      ...(isDragAccept ? acceptStyle : {}),
      ...(isDragReject ? rejectStyle : {}),
    }),
    [isFocused, isDragAccept, isDragReject]
  )

  let activeText = (() => {
    if (isDragAccept) {
      return 'Drop the files here...'
    }
    if (isDragReject) {
      return 'The type of this file is incorrect.'
    }
    if (isDragActive) {
      return 'Drop the files here...'
    }
    return nonActiveStr
  })()

  return (
    <div
      {...getRootProps({
        style: style as React.CSSProperties,
        className: cn(
          'text-foreground-500 border-foreground-300 cursor-pointer p-4 bg-accent-50 w-full text-center text-sm rounded-lg',
          className
        ),
      })}
    >
      <input {...getInputProps()} />
      <p>
        {activeText}
        {required && <span className="text-danger"> *</span>}
      </p>
    </div>
  )
}
