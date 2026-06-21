import { useState, useContext } from "react"
import { Navigate } from "react-router-dom"
import axios from "axios"
import { toast } from "sonner"
import { Context } from "@/Context/Context"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Loader2, ArrowLeft } from "lucide-react"

const API_URL = import.meta.env.VITE_API_URL

export default function PublishUpdate() {
  const { user, loading } = useContext(Context)
  const [version, setVersion] = useState("")
  const [releaseNotes, setReleaseNotes] = useState("")
  const [critical, setCritical] = useState(false)
  const [apkFile, setApkFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center w-full">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  if (!user || !user.isAdmin) {
    return <Navigate to="/" replace />
  }

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setApkFile(e.target.files[0])
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!version.trim()) {
      toast.error("Please enter a version number")
      return
    }
    if (!apkFile) {
      toast.error("Please select an APK file")
      return
    }

    setUploading(true)
    setUploadProgress(0)

    try {
      const { data } = await axios.get(
        `${API_URL}/api/app-update/presigned-url?version=${encodeURIComponent(version.trim())}`,
        { withCredentials: true }
      )

      if (!data.success || !data.uploadUrl) {
        throw new Error("Failed to get presigned URL")
      }

      await axios.put(data.uploadUrl, apkFile, {
        headers: {
          "Content-Type": "application/vnd.android.package-archive",
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          setUploadProgress(percentCompleted)
        },
      })

      const response = await axios.post(
        `${API_URL}/api/app-update`,
        {
          version: version.trim(),
          releaseNotes: releaseNotes.trim(),
          downloadUrl: data.downloadUrl,
          critical,
        },
        { withCredentials: true }
      )

      if (response.data.success) {
        toast.success("App update published successfully!")
        setVersion("")
        setReleaseNotes("")
        setCritical(false)
        setApkFile(null)
      } else {
        throw new Error("Failed to save update record")
      }
    } catch (error) {
      console.error(error)
      toast.error(error.response?.data?.message || error.message || "An error occurred during publication")
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  return (
    <div className="container max-w-lg mx-auto py-10 px-4">
      <Card className="border border-border/40 bg-card/60 backdrop-blur-md shadow-lg">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground hover:text-foreground cursor-pointer text-sm font-medium transition-colors" onClick={() => window.history.back()}>
            <ArrowLeft className="w-4 h-4" /> Back
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Publish App Update</CardTitle>
          <CardDescription className="text-muted-foreground text-sm">
            Generate R2 presigned URLs, upload APK directly, and alert mobile clients.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="version" className="text-sm font-semibold">App Version</Label>
              <Input
                id="version"
                type="text"
                placeholder="e.g. 1.0.1"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                disabled={uploading}
                className="w-full bg-background/50 border-border/60"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-sm font-semibold">Release Notes / Features</Label>
              <Textarea
                id="notes"
                placeholder="List new features, bug fixes, or improvements..."
                value={releaseNotes}
                onChange={(e) => setReleaseNotes(e.target.value)}
                disabled={uploading}
                rows={4}
                className="w-full bg-background/50 border-border/60 resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="apk" className="text-sm font-semibold">Select APK File</Label>
              <Input
                id="apk"
                type="file"
                accept=".apk"
                onChange={handleFileChange}
                disabled={uploading}
                className="w-full bg-background/50 border-border/60 file:bg-primary file:text-primary-foreground file:border-0 file:rounded-md file:px-3 file:py-1 file:mr-3 file:hover:opacity-90 file:cursor-pointer"
              />
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <input
                id="critical"
                type="checkbox"
                checked={critical}
                onChange={(e) => setCritical(e.target.checked)}
                disabled={uploading}
                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary"
              />
              <Label htmlFor="critical" className="text-sm font-semibold select-none cursor-pointer">
                This is a critical / mandatory update
              </Label>
            </div>

            {uploading && (
              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-xs text-muted-foreground font-semibold">
                  <span>Uploading APK to Cloudflare R2...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}

            <Button type="submit" disabled={uploading} className="w-full font-bold shadow-md hover:shadow-lg transition-all py-6 mt-2">
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading {uploadProgress}%
                </>
              ) : (
                "Publish Update"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
