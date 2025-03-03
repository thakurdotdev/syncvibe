import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

// Enhanced Root component with swipe functionality
const SwipeableTabs = React.forwardRef(
  (
    {
      children,
      defaultValue,
      value,
      onValueChange,
      className,
      swipeThreshold = 50,
      disableSwipe = false,
      ...props
    },
    ref,
  ) => {
    const [activeTab, setActiveTab] = React.useState(value || defaultValue);
    const touchStartX = React.useRef(null);
    const contentRef = React.useRef(null);

    // Get all tab values from children
    const tabValues = React.useMemo(() => {
      // Extract tab values from TabsTrigger children
      const values = [];
      React.Children.forEach(children, (child) => {
        if (!React.isValidElement(child)) return;

        if (child.type === TabsList) {
          React.Children.forEach(child.props.children, (trigger) => {
            if (
              React.isValidElement(trigger) &&
              trigger.type === TabsTrigger &&
              trigger.props.value
            ) {
              values.push(trigger.props.value);
            }
          });
        }
      });
      return values;
    }, [children]);

    React.useEffect(() => {
      if (value !== undefined) {
        setActiveTab(value);
      }
    }, [value]);

    const handleTabChange = (newValue) => {
      setActiveTab(newValue);
      if (onValueChange) {
        onValueChange(newValue);
      }
    };

    const handleTouchStart = (e) => {
      if (disableSwipe) return;
      touchStartX.current = e.touches[0].clientX;
    };

    const handleTouchEnd = (e) => {
      if (disableSwipe || touchStartX.current === null) return;

      const touchEndX = e.changedTouches[0].clientX;
      const diff = touchStartX.current - touchEndX;

      // Only switch tabs if the swipe is significant enough
      if (Math.abs(diff) > swipeThreshold) {
        const currentIndex = tabValues.indexOf(activeTab);

        if (diff > 0 && currentIndex < tabValues.length - 1) {
          // Swipe left, go to next tab
          handleTabChange(tabValues[currentIndex + 1]);
        } else if (diff < 0 && currentIndex > 0) {
          // Swipe right, go to previous tab
          handleTabChange(tabValues[currentIndex - 1]);
        }
      }

      touchStartX.current = null;
    };

    return (
      <div
        ref={contentRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={cn("relative", className)}
      >
        <TabsPrimitive.Root
          ref={ref}
          value={activeTab}
          onValueChange={handleTabChange}
          defaultValue={defaultValue}
          {...props}
        >
          {children}
        </TabsPrimitive.Root>

        {/* Optional swipe indicators */}
        {!disableSwipe && tabValues.length > 1 && (
          <div className="flex justify-center mt-4 space-x-2">
            {tabValues.map((tabValue) => (
              <div
                key={tabValue}
                className={cn(
                  "h-2 w-2 rounded-full transition-colors duration-300",
                  activeTab === tabValue ? "bg-primary" : "bg-muted",
                )}
              />
            ))}
          </div>
        )}
      </div>
    );
  },
);
SwipeableTabs.displayName = "SwipeableTabs";

// Re-export original components
const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

// Enhanced TabsContent with transition effects
const TabsContent = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-opacity duration-300",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent, SwipeableTabs };
