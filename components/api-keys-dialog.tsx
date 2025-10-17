'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Eye, EyeOff, Trash2, Check } from 'lucide-react'

interface ApiKeysDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Provider = 'openai' | 'gemini' | 'cursor' | 'anthropic' | 'aigateway'

const PROVIDERS = [
  { id: 'aigateway' as Provider, name: 'AI Gateway', placeholder: 'gw_...' },
  { id: 'anthropic' as Provider, name: 'Anthropic', placeholder: 'sk-ant-...' },
  { id: 'openai' as Provider, name: 'OpenAI', placeholder: 'sk-...' },
  { id: 'gemini' as Provider, name: 'Gemini', placeholder: 'AIza...' },
  { id: 'cursor' as Provider, name: 'Cursor', placeholder: 'cur_...' },
]

export function ApiKeysDialog({ open, onOpenChange }: ApiKeysDialogProps) {
  const [apiKeys, setApiKeys] = useState<Record<Provider, string>>({
    openai: '',
    gemini: '',
    cursor: '',
    anthropic: '',
    aigateway: '',
  })
  const [savedKeys, setSavedKeys] = useState<Set<Provider>>(new Set())
  const [showKeys, setShowKeys] = useState<Record<Provider, boolean>>({
    openai: false,
    gemini: false,
    cursor: false,
    anthropic: false,
    aigateway: false,
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      fetchApiKeys()
    }
  }, [open])

  const fetchApiKeys = async () => {
    try {
      const response = await fetch('/api/api-keys')
      const data = await response.json()

      if (data.success) {
        const saved = new Set<Provider>()
        data.apiKeys.forEach((key: { provider: Provider }) => {
          saved.add(key.provider)
        })
        setSavedKeys(saved)
      }
    } catch (error) {
      console.error('Error fetching API keys:', error)
    }
  }

  const handleSave = async (provider: Provider) => {
    const key = apiKeys[provider]
    if (!key.trim()) {
      toast.error('Please enter an API key')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider,
          apiKey: key,
        }),
      })

      if (response.ok) {
        toast.success(`${PROVIDERS.find((p) => p.id === provider)?.name} API key saved`)
        setSavedKeys((prev) => new Set(prev).add(provider))
        setApiKeys((prev) => ({ ...prev, [provider]: '' }))
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to save API key')
      }
    } catch (error) {
      console.error('Error saving API key:', error)
      toast.error('Failed to save API key')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (provider: Provider) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/api-keys?provider=${provider}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success(`${PROVIDERS.find((p) => p.id === provider)?.name} API key deleted`)
        setSavedKeys((prev) => {
          const newSet = new Set(prev)
          newSet.delete(provider)
          return newSet
        })
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to delete API key')
      }
    } catch (error) {
      console.error('Error deleting API key:', error)
      toast.error('Failed to delete API key')
    } finally {
      setLoading(false)
    }
  }

  const toggleShowKey = (provider: Provider) => {
    setShowKeys((prev) => ({ ...prev, [provider]: !prev[provider] }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage API Keys</DialogTitle>
          <DialogDescription>
            Add your own API keys for AI agents. If not provided, system keys will be used.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {PROVIDERS.map((provider) => (
            <div key={provider.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor={provider.id} className="font-medium">
                  {provider.name}
                </Label>
                {savedKeys.has(provider.id) && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-green-600 flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      Saved
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(provider.id)}
                      disabled={loading}
                      className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                      title="Delete API key"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id={provider.id}
                    type={showKeys[provider.id] ? 'text' : 'password'}
                    placeholder={provider.placeholder}
                    value={apiKeys[provider.id]}
                    onChange={(e) => setApiKeys((prev) => ({ ...prev, [provider.id]: e.target.value }))}
                    disabled={loading}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleShowKey(provider.id)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    type="button"
                  >
                    {showKeys[provider.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <Button onClick={() => handleSave(provider.id)} disabled={loading || !apiKeys[provider.id].trim()}>
                  Save
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
