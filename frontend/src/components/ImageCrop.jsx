import React, { useCallback, useEffect, useRef, useState } from 'react'
import Cropper from 'react-easy-crop'

const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (error) => reject(error))
    image.setAttribute('crossOrigin', 'anonymous')
    image.src = url
  })

export default function ImageCrop({ image, onCropComplete, onCancel }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [croppedPreview, setCroppedPreview] = useState(null)
  const previewCanvasRef = useRef(null)

  const onCropChange = (crop) => {
    setCrop(crop)
  }

  const onZoomChange = (zoom) => {
    setZoom(zoom)
  }

  const onCropCompleteHandler = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const handleSave = useCallback(async () => {
    if (!croppedAreaPixels || !image) return

    try {
      const croppedImage = await getCroppedImg(image, croppedAreaPixels)
      onCropComplete(croppedImage)
    } catch (error) {
      console.error('Error cropping image:', error)
    }
  }, [croppedAreaPixels, image, onCropComplete])

  useEffect(() => {
    const updatePreview = async () => {
      if (croppedAreaPixels && image && previewCanvasRef.current) {
        try {
          await renderCroppedPreview(image, croppedAreaPixels, previewCanvasRef.current)
          const dataUrl = previewCanvasRef.current.toDataURL('image/jpeg', 0.9)
          setCroppedPreview(dataUrl)
        } catch (error) {
          console.error('Error updating preview:', error)
        }
      }
    }
    updatePreview()
  }, [croppedAreaPixels, image])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="relative w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl">
        <h3 className="text-lg font-bold text-brand-text mb-4">Adjust Profile Picture</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="relative h-64 w-full bg-slate-100 rounded-xl overflow-hidden">
            <Cropper
              image={image}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={onCropChange}
              onZoomChange={onZoomChange}
              onCropComplete={onCropCompleteHandler}
              cropShape="round"
              showGrid={false}
              style={{
                containerStyle: {
                  width: '100%',
                  height: '100%',
                },
              }}
            />
          </div>

          <div className="flex flex-col items-center justify-center bg-slate-50 rounded-xl p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
              Preview
            </p>
            <div className="h-32 w-32 rounded-full overflow-hidden border-4 border-white shadow-lg">
              {croppedPreview ? (
                <img src={croppedPreview} alt="Preview" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-slate-200 flex items-center justify-center text-slate-400">
                  <span className="text-xs">Loading...</span>
                </div>
              )}
            </div>
            <canvas
              ref={previewCanvasRef}
              width={300}
              height={300}
              style={{ display: 'none' }}
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            Zoom
          </label>
          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-teal"
          />
        </div>

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 active:scale-95"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-xl bg-brand-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-teal-dark active:scale-95"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

async function renderCroppedPreview(imageSrc, pixelCrop, canvas) {
  const image = await createImage(imageSrc)
  const ctx = canvas.getContext('2d')

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  const outputSize = 300
  const scale = outputSize / pixelCrop.width

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputSize,
    outputSize
  )
}

async function getCroppedImg(imageSrc, pixelCrop) {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  canvas.width = 300
  canvas.height = 300

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  const outputSize = 300
  const scale = outputSize / pixelCrop.width

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputSize,
    outputSize
  )

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        const reader = new FileReader()
        reader.readAsDataURL(blob)
        reader.onloadend = () => {
          resolve(reader.result)
        }
      },
      'image/jpeg',
      0.9
    )
  })
}
