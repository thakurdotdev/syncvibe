import { PlusIcon } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"

const CreatePostButton = () => {
  const navigate = useNavigate()

  return (
    <Button
      variant="secondary"
      className="h-10 max-md:w-10 flex items-center gap-2 rounded-full"
      title="Create Post"
      onClick={() => navigate("/post/create")}
    >
      <PlusIcon />
      <span className="hidden md:block">Create</span>
    </Button>
  )
}

export default CreatePostButton
