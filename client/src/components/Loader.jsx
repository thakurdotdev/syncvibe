import { Loader2 } from "lucide-react";

const LoadingScreen = ({ isLoading, children }) => {
  return (
    <div className="relative w-full">
      {children}
      {isLoading && (
        <div className="max-h-dvh fixed inset-0 z-[999] bg-black backdrop-blur-sm flex justify-center items-center w-full">
          <div className="flex justify-center items-center">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        </div>
      )}
    </div>
  );
};

export default LoadingScreen;
