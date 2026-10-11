import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ShieldAlert, Home, LayoutDashboard, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 relative overflow-hidden">
            {/* Ambient Background Glows */}
            <div className="absolute top-1/4 left-1/4 size-96 bg-primary/10 blur-[120px] rounded-full -z-10 animate-pulse" />
            <div className="absolute bottom-1/4 right-1/4 size-96 bg-primary/5 blur-[120px] rounded-full -z-10 animate-pulse delay-700" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="w-full max-w-md text-center"
            >
                <div className="mb-6 flex flex-col items-center justify-center">
                    <motion.div
                        animate={{ rotate: [0, 5, -5, 0] }}
                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                        className="mb-2"
                    >
                        <ShieldAlert className="size-16 text-primary opacity-50" />
                    </motion.div>
                    <h1 className="text-8xl font-black tracking-tight leading-none bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/40">
                        404
                    </h1>
                </div>

                <h1 className="text-3xl font-bold tracking-tight mb-3">Lost in Compliance?</h1>
                <p className="text-muted-foreground mb-10 leading-relaxed">
                    The policy or page you are looking for has either been moved, audited out of existence, or never existed in the first place.
                </p>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Button asChild variant="default" className="w-full group">
                        <Link to="/">
                            <Home className="mr-2 size-4 group-hover:scale-110 transition-transform" />
                            Return Home
                        </Link>
                    </Button>
                    <Button asChild variant="outline" className="w-full group">
                        <Link to="/login">
                            <LayoutDashboard className="mr-2 size-4 group-hover:scale-110 transition-transform" />
                            Login
                        </Link>
                    </Button>
                </div>

                <div className="mt-12 pt-8 border-t border-border/50">
                    <p className="text-sm text-muted-foreground mb-4 font-medium uppercase tracking-widest">Contact Support</p>
                    <a 
                      href="mailto:support@example.com"
                      className="text-primary hover:underline font-medium transition-colors flex items-center justify-center gap-2"
                    >
                        <HelpCircle className="size-4" />
                        support@example.com
                    </a>
                </div>
            </motion.div>

            {/* Subtle decorative grid */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] -z-20" />
        </div>
    );
};

export default NotFound;
