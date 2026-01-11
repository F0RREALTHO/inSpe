import { useRouter, useSegments } from "expo-router";
import { onAuthStateChanged, User } from "firebase/auth";
import { useEffect, useState } from "react";
import { auth } from "../../firebaseConfig"; // Adjust path if needed
import { useData } from "../context/DataProvider";

export default function AuthProtection({ onReady }: { onReady: () => void }) {
    const router = useRouter();
    const segments = useSegments();
    const { userData, loading: dataLoading } = useData();
    const [user, setUser] = useState<User | null>(auth.currentUser);
    const [authLoading, setAuthLoading] = useState(true);


    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setAuthLoading(false);
        });
        return unsub;
    }, []);

    useEffect(() => {
        if (authLoading || dataLoading) return;


        const currentSegments = segments as string[];
        const isLoginScreen = currentSegments.length === 0 || currentSegments[0] === "index";
        const isOnboarding = currentSegments[0] === "onboarding";
        const isProtected = !isLoginScreen && !isOnboarding;

        let redirected = false;

        if (user) {
            const isNewUser = !userData?.onboardingComplete;

            if (isNewUser) {
                if (!isOnboarding) {
                    router.replace("/onboarding");
                    redirected = true;
                }
            } else {
                if (isLoginScreen || isOnboarding) {
                    router.replace("/(tabs)/home");
                    redirected = true;
                }
            }
        } else {
            if (isProtected) {
                router.replace("/");
                redirected = true;
            }
        }

        if (onReady) {
            setTimeout(() => {
                onReady();
            }, 50);
        }

    }, [user, userData, authLoading, dataLoading, segments]);

    return null;
}
