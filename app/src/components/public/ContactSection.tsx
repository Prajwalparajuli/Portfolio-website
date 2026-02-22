import { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { submitContactMessage } from '@/lib/supabase'
import { Mail, Loader2, CheckCircle, Github, Linkedin, Twitter } from 'lucide-react'
import { PortfolioSettings } from '@/types'

interface ContactSectionProps {
  settings: PortfolioSettings
}

export function ContactSection({ settings }: ContactSectionProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

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

  return (
    <section id="contact" className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-start">
          {/* Left: headline + socials */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight gradient-text mb-4 leading-tight pb-1">
              Let's build something together
            </h2>
            <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
              Have a project in mind, want to collaborate, or just want to say hi? Drop me a message and I'll get back to you.
            </p>

            {settings.contact_email && (
              <a
                href={`mailto:${settings.contact_email}`}
                className="inline-flex items-center gap-2 text-foreground font-mono text-sm mb-6 hover:opacity-80 transition-opacity"
              >
                <Mail className="h-4 w-4" />
                {settings.contact_email}
              </a>
            )}

            {socials.length > 0 && (
              <div className="flex items-center gap-3 mt-4">
                {socials.map((s) => (
                  <a
                    key={s.label}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-xl glass hover:bg-white/10 transition-colors"
                    title={s.label}
                  >
                    <s.icon className="h-5 w-5" />
                  </a>
                ))}
              </div>
            )}
          </motion.div>

          {/* Right: form */}
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            onSubmit={handleSubmit}
            className="space-y-4 glass rounded-2xl p-6"
          >
            <div className="space-y-2">
              <Label htmlFor="contact-name" className="font-mono text-xs uppercase tracking-wider">Name</Label>
              <Input
                id="contact-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="bg-black/40 border-white/10"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-email" className="font-mono text-xs uppercase tracking-wider">Email</Label>
              <Input
                id="contact-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="bg-black/40 border-white/10"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-message" className="font-mono text-xs uppercase tracking-wider">Message</Label>
              <Textarea
                id="contact-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Your message..."
                className="min-h-[120px] bg-black/40 border-white/10 resize-none"
                required
              />
            </div>
            {status === 'sent' && (
              <p className="flex items-center gap-2 text-sm text-green-400">
                <CheckCircle className="h-4 w-4" />
                Message sent. I'll get back to you soon.
              </p>
            )}
            {status === 'error' && (
              <p className="text-sm text-destructive">{errorMessage}</p>
            )}
            <Button
              type="submit"
              disabled={status === 'sending'}
              className="w-full sm:w-auto"
            >
              {status === 'sending' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Send message
                </>
              )}
            </Button>
          </motion.form>
        </div>
      </div>
    </section>
  )
}
