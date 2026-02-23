import { useState, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { submitContactMessage } from '@/lib/supabase'
import { Mail, Loader2, CheckCircle, Github, Linkedin, Twitter, Send } from 'lucide-react'
import { PortfolioSettings } from '@/types'
import { cn } from '@/lib/utils'

interface ContactSectionProps {
  settings: PortfolioSettings
}

// Spotlight effect hook for form
function useSpotlight(ref: React.RefObject<HTMLElement>) {
  const [position, setPosition] = useState({ x: 50, y: 50 })
  const [isHovering, setIsHovering] = useState(false)

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setPosition({ x, y })
  }, [ref])

  return { position, isHovering, handleMouseMove, setIsHovering }
}

export function ContactSection({ settings }: ContactSectionProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const formRef = useRef<HTMLFormElement>(null)
  const { position, isHovering, handleMouseMove, setIsHovering } = useSpotlight(formRef as React.RefObject<HTMLElement>)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('sending')
    setErrorMessage('')
    try {
      await submitContactMessage({ name, email, message })
      setStatus('sent')
      setName('')
      setEmail('')
      setMessage('')
    } catch (err) {
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong.')
    }
  }

  const socials = [
    { url: settings.github_url, icon: Github, label: 'GitHub' },
    { url: settings.linkedin_url, icon: Linkedin, label: 'LinkedIn' },
    { url: settings.twitter_url, icon: Twitter, label: 'Twitter' },
  ].filter((s) => s.url)

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const }
    }
  }

  return (
    <section id="contact" className="py-24 md:py-32 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={containerVariants}
          className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-start"
        >
          {/* Left: headline + socials */}
          <motion.div variants={itemVariants}>
            <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight gradient-text mb-6 leading-tight">
              Let's build something together
            </h2>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed max-w-lg">
              Have a project in mind, want to collaborate, or just want to say hi? Drop me a message and I'll get back to you soon.
            </p>

            {settings.contact_email && (
              <motion.a
                href={`mailto:${settings.contact_email}`}
                className="inline-flex items-center gap-3 text-foreground font-mono text-sm mb-8 hover:text-accent transition-colors group"
                whileHover={{ x: 4 }}
              >
                <span className="p-2 rounded-lg glass">
                  <Mail className="h-4 w-4" />
                </span>
                <span className="link-hover">{settings.contact_email}</span>
              </motion.a>
            )}

            {socials.length > 0 && (
              <div className="flex items-center gap-3 mt-6">
                {socials.map((s, index) => (
                  <motion.a
                    key={s.label}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-xl glass hover:glass-strong transition-all group"
                    title={s.label}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 + index * 0.1 }}
                    whileHover={{ y: -2, scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <s.icon className="h-5 w-5 group-hover:text-accent transition-colors" />
                  </motion.a>
                ))}
              </div>
            )}
          </motion.div>

          {/* Right: form with spotlight effect */}
          <motion.form
            ref={formRef}
            variants={itemVariants}
            onSubmit={handleSubmit}
            onMouseMove={handleMouseMove}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            className="relative glass-strong rounded-2xl p-6 overflow-hidden"
            style={{
              '--mouse-x': `${position.x}%`,
              '--mouse-y': `${position.y}%`,
            } as React.CSSProperties}
          >
            {/* Spotlight overlay */}
            <div 
              className={cn(
                'absolute inset-0 pointer-events-none transition-opacity duration-300',
                isHovering ? 'opacity-100' : 'opacity-0'
              )}
              style={{
                background: `radial-gradient(400px circle at ${position.x}% ${position.y}%, hsla(var(--accent-hue), 50%, 50%, 0.08), transparent 50%)`,
              }}
            />

            <div className="relative z-10 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="contact-name" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Name
                </Label>
                <Input
                  id="contact-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="bg-surface/50 border-border/50 focus:border-accent/50 transition-colors rounded-xl"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="contact-email" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Email
                </Label>
                <Input
                  id="contact-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="bg-surface/50 border-border/50 focus:border-accent/50 transition-colors rounded-xl"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="contact-message" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Message
                </Label>
                <Textarea
                  id="contact-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell me about your project..."
                  className="min-h-[140px] bg-surface/50 border-border/50 focus:border-accent/50 transition-colors resize-none rounded-xl"
                  required
                />
              </div>

              {/* Status messages */}
              {status === 'sent' && (
                <motion.p 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 text-sm text-success"
                >
                  <CheckCircle className="h-4 w-4" />
                  Message sent! I'll get back to you soon.
                </motion.p>
              )}
              
              {status === 'error' && (
                <motion.p 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-destructive"
                >
                  {errorMessage}
                </motion.p>
              )}

              <Button
                type="submit"
                disabled={status === 'sending'}
                className="w-full sm:w-auto rounded-xl"
                size="lg"
              >
                {status === 'sending' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send message
                  </>
                )}
              </Button>
            </div>
          </motion.form>
        </motion.div>
      </div>
    </section>
  )
}
