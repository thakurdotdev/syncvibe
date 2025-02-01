import { useEffect, useRef } from "react";
import { useNavigation } from "react-router-dom";
import LoadingBar from "react-top-loading-bar";

export function NavigationLoadingBar() {
  const navigation = useNavigation();
  const ref = useRef(null);

  useEffect(() => {
    if (navigation.state === "loading" || navigation.state === "submitting") {
      ref.current?.continuousStart();
    }

    if (navigation.state === "idle") {
      ref.current?.complete();
    }
  }, [navigation.state]);

  return (
    <LoadingBar
      ref={ref}
      color="#138058"
      shadow={false}
      height={5}
      transitionTime={100}
      waitingTime={300}
    />
  );
}
