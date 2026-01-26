import { useForm } from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup"
import * as Yup from "yup"
import { useUpdatePostMutation } from "@/hooks/mutations/usePostMutations"
import { toast } from "sonner"
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/revola"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form"
import { Loader2 } from "lucide-react"

const validationSchema = Yup.object().shape({
  content: Yup.string().required("Content is required"),
})

const UpdatePost = ({ isOpen, toggleDialog, post }) => {
  const form = useForm({
    resolver: yupResolver(validationSchema),
    defaultValues: {
      content: post?.content,
    },
  })

  const updateMutation = useUpdatePostMutation()

  const onSubmit = (values) => {
    updateMutation.mutate(
      { postid: post?.postid, content: values.content },
      {
        onSuccess: () => {
          toast.success("Post updated successfully")
          toggleDialog()
          form.reset({ content: post?.content })
        },
        onError: (error) => {
          toast.error(error.response?.data?.message || "Failed to update post")
        },
      },
    )
  }

  return (
    <ResponsiveDialog
      open={isOpen}
      onOpenChange={() => {
        toggleDialog()
        form.reset({ content: post?.content })
      }}
    >
      <ResponsiveDialogContent className="sm:max-w-[425px] p-0 flex flex-col max-sm:h-auto max-sm:max-h-[90%]">
        <ResponsiveDialogHeader className="px-4 pt-4 sm:px-6 sm:pt-6 flex-shrink-0">
          <ResponsiveDialogTitle>Update Post</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <div className="px-4 pb-4 sm:px-6 sm:pb-6 overflow-y-auto flex-1">
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

              <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? (
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
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}

export default UpdatePost
