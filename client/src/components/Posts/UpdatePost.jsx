import { useState } from "react"
import { useForm } from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup"
import * as Yup from "yup"
import axios from "axios"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form"
import { Loader2 } from "lucide-react"

const validationSchema = Yup.object().shape({
  content: Yup.string().required("Content is required"),
})

const UpdatePost = ({ isOpen, toggleDialog, post, getAllPosts }) => {
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm({
    resolver: yupResolver(validationSchema),
    defaultValues: {
      content: post?.content,
    },
  })

  const onSubmit = async (values) => {
    setIsLoading(true)
    const formData = new FormData()
    formData.append("content", values.content)

    try {
      const response = await axios.patch(
        `${import.meta.env.VITE_API_URL}/api/post/update/${post?.postid}`,
        formData,
        {
          withCredentials: true,
          headers: { "Content-Type": "multipart/form-data" },
        },
      )
      if (response.status === 200) {
        toast.success("Post updated successfully")
        getAllPosts()
        toggleDialog()
        form.reset({ content: post?.content })
      } else {
        throw new Error("Failed to update post")
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Failed to update post"
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={() => {
        toggleDialog()
        form.reset({ content: post?.content })
      }}
    >
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Update Post</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      placeholder="What's on your mind?"
                      className="min-h-[100px] resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {post?.images?.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {post.images.map((image, index) => (
                  <img
                    key={index}
                    src={image.image}
                    alt={`Post image ${index + 1}`}
                    className="w-full h-auto object-cover rounded-lg"
                    loading="lazy"
                  />
                ))}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update"
              )}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default UpdatePost
