import { Link } from 'react-router-dom'
import { SignedIn, SignedOut, SignInButton } from '@clerk/clerk-react'
import { PenTool, Zap, Globe, Clock, ArrowRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

const features = [
  {
    icon: Zap,
    title: 'AI-Powered Content',
    description: 'Generate high-quality, SEO-optimized blog posts using Groq AI with llama-3.3-70b model.',
  },
  {
    icon: Globe,
    title: 'Multi-Platform Publishing',
    description: 'Publish directly to WordPress and Next.js sites with automatic formatting.',
  },
  {
    icon: Clock,
    title: 'Automated Scheduling',
    description: 'Set up recurring workflows with n8n to publish content on your schedule.',
  },
]

const pricingPlans = [
  {
    name: 'Free',
    price: '$0',
    description: 'Perfect for trying out AutoBlog',
    features: ['5 posts per month', '1 connected site', 'Basic AI generation', 'Email support'],
    cta: 'Get Started',
    popular: false,
  },
  {
    name: 'Pro',
    price: '$29',
    description: 'For serious content creators',
    features: ['Unlimited posts', '10 connected sites', 'Advanced AI generation', 'Priority support', 'n8n workflows'],
    cta: 'Start Pro Trial',
    popular: true,
  },
  {
    name: 'Agency',
    price: '$99',
    description: 'For agencies and teams',
    features: ['Unlimited everything', 'Unlimited sites', 'Custom AI training', 'Dedicated support', 'Team collaboration'],
    cta: 'Contact Sales',
    popular: false,
  },
]

export function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <PenTool className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">AutoBlog</span>
          </div>
          <nav className="flex items-center gap-4">
            <SignedIn>
              <Link to="/dashboard">
                <Button>Dashboard</Button>
              </Link>
            </SignedIn>
            <SignedOut>
              <SignInButton mode="modal">
                <Button variant="outline">Sign In</Button>
              </SignInButton>
            </SignedOut>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-24 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          Automate Your Blog with{' '}
          <span className="text-primary">AI Power</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          AutoBlog generates and publishes high-quality content to your WordPress and Next.js sites automatically. 
          Connect your sites, set up workflows, and let AI handle the rest.
        </p>
        <div className="mt-10 flex justify-center gap-4">
          <SignedIn>
            <Link to="/dashboard">
              <Button size="lg">
                Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <Button size="lg">
                Get Started Free <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </SignInButton>
          </SignedOut>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-24">
        <h2 className="text-center text-3xl font-bold">Everything you need to scale your content</h2>
        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title}>
              <CardContent className="pt-6">
                <feature.icon className="h-10 w-10 text-primary" />
                <h3 className="mt-4 text-xl font-semibold">{feature.title}</h3>
                <p className="mt-2 text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="container mx-auto px-4 py-24">
        <h2 className="text-center text-3xl font-bold">Simple, transparent pricing</h2>
        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {pricingPlans.map((plan) => (
            <Card key={plan.name} className={plan.popular ? 'border-primary' : ''}>
              <CardContent className="pt-6">
                {plan.popular && (
                  <span className="inline-block rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                    Most Popular
                  </span>
                )}
                <h3 className="mt-4 text-2xl font-bold">{plan.name}</h3>
                <p className="mt-2 text-muted-foreground">{plan.description}</p>
                <p className="mt-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">/month</span>
                </p>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <SignedIn>
                  <Button className="mt-6 w-full" variant={plan.popular ? 'default' : 'outline'}>
                    {plan.cta}
                  </Button>
                </SignedIn>
                <SignedOut>
                  <SignInButton mode="modal">
                    <Button className="mt-6 w-full" variant={plan.popular ? 'default' : 'outline'}>
                      {plan.cta}
                    </Button>
                  </SignInButton>
                </SignedOut>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} AutoBlog. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
