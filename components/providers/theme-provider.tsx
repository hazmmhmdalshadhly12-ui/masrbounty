'use client'
import { ThemeProvider as NT } from 'next-themes';
export function ThemeProvider({children}:{children:React.ReactNode}){return <NT attribute="class" defaultTheme="system" enableSystem>{children}</NT>}
