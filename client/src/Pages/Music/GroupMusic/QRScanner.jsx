import { useEffect, useRef, useState } from "react"
import { Html5Qrcode } from "html5-qrcode"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Camera, CameraOff, SwitchCamera, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

const QRScanner = ({ isOpen, onClose, onScan }) => {
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState(null)
  const [cameras, setCameras] = useState([])
  const [currentCamera, setCurrentCamera] = useState(0)
  const scannerRef = useRef(null)
  const html5QrCodeRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      Html5Qrcode.getCameras()
        .then((devices) => {
          if (devices && devices.length) {
            setCameras(devices)
          } else {
            setError("No cameras found")
          }
        })
        .catch((err) => {
          console.error("Error getting cameras:", err)
          setError("Could not access cameras")
        })
    }

    return () => {
      stopScanning()
    }
  }, [isOpen])

  const startScanning = async () => {
    if (!cameras.length) return

    setError(null)
    setIsScanning(true)

    try {
      html5QrCodeRef.current = new Html5Qrcode("qr-reader")

      await html5QrCodeRef.current.start(
        cameras[currentCamera].id,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          // Check if it's a valid SyncVibe group ID
          if (decodedText.startsWith("syncvibe_")) {
            onScan(decodedText)
            stopScanning()
            onClose()
          }
        },
        (errorMessage) => {
          // Ignore scan errors (expected when no QR code is in view)
        },
      )
    } catch (err) {
      console.error("Error starting scanner:", err)
      setError("Could not start camera. Please check permissions.")
      setIsScanning(false)
    }
  }

  const stopScanning = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop()
        html5QrCodeRef.current.clear()
      } catch (err) {
        console.error("Error stopping scanner:", err)
      }
    }
    setIsScanning(false)
  }

  const switchCamera = async () => {
    if (cameras.length <= 1) return

    await stopScanning()
    const nextCamera = (currentCamera + 1) % cameras.length
    setCurrentCamera(nextCamera)
  }

  const handleClose = () => {
    stopScanning()
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-center">Scan QR Code to Join</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Scanner Container */}
          <div
            className={cn(
              "relative w-full aspect-square rounded-xl overflow-hidden",
              "bg-gradient-to-br from-accent/30 to-accent/10",
              "border border-border/50",
            )}
          >
            <div id="qr-reader" ref={scannerRef} className="w-full h-full" />

            {!isScanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/80 backdrop-blur-sm">
                <Camera className="h-16 w-16 text-muted-foreground" />
                <p className="text-muted-foreground text-center px-4">
                  {error || "Click start to open camera and scan QR code"}
                </p>
              </div>
            )}

            {isScanning && (
              <div className="absolute inset-0 pointer-events-none">
                {/* Scanning overlay with corners */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative w-64 h-64">
                    {/* Corner decorations */}
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />

                    {/* Scanning line animation */}
                    <div className="absolute inset-x-2 h-0.5 bg-primary/50 animate-pulse top-1/2" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-3">
            {!isScanning ? (
              <Button
                onClick={startScanning}
                disabled={!cameras.length}
                className="rounded-full px-6"
              >
                <Camera className="mr-2 h-4 w-4" />
                Start Scanning
              </Button>
            ) : (
              <>
                <Button onClick={stopScanning} variant="destructive" className="rounded-full px-6">
                  <CameraOff className="mr-2 h-4 w-4" />
                  Stop
                </Button>

                {cameras.length > 1 && (
                  <Button
                    onClick={switchCamera}
                    variant="outline"
                    className="rounded-full"
                    size="icon"
                  >
                    <SwitchCamera className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Point your camera at a SyncVibe group QR code to join
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default QRScanner
