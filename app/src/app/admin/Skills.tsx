import { useEffect, useState } from 'react'
import { Skill } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import { getSkills, createSkill, deleteSkill } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

const PRESET_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
]

export function AdminSkills() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [newSkillName, setNewSkillName] = useState('')
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0])
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    getSkills().then(setSkills)
  }, [])

  const handleAddSkill = async () => {
    if (!newSkillName.trim()) return

    setIsSubmitting(true)
    try {
      const skill = await createSkill(newSkillName.trim(), 'technical', selectedColor)
      if (skill) {
        setSkills([...skills, skill])
        setNewSkillName('')
      }
    } catch (error) {
      console.error('Error creating skill:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteSkill = async (id: string) => {
    try {
      await deleteSkill(id)
      setSkills(skills.filter(s => s.id !== id))
    } catch (error) {
      console.error('Error deleting skill:', error)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold gradient-text">Skills</h1>
        <p className="text-muted-foreground mt-1">
          Manage skills available for tagging projects
        </p>
      </div>

      <div className="space-y-6">
        <Card className="glass">
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <Label>Add New Skill</Label>
              <div className="flex gap-2">
                <Input
                  value={newSkillName}
                  onChange={(e) => setNewSkillName(e.target.value)}
                  placeholder="e.g., Python, React, Machine Learning..."
                  className="bg-black/40 border-white/10"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddSkill()
                    }
                  }}
                />
                <Button 
                  onClick={handleAddSkill} 
                  disabled={isSubmitting || !newSkillName.trim()}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Add
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    className={cn(
                      "w-8 h-8 rounded-full transition-all",
                      selectedColor === color && "ring-2 ring-white ring-offset-2 ring-offset-black"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {skills.map((skill) => (
            <Card key={skill.id} className="glass">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: skill.color }}
                  />
                  <span className="font-medium">{skill.name}</span>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="glass-strong">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Skill</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete &quot;{skill.name}&quot;? This will remove it from all projects.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDeleteSkill(skill.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          ))}
        </div>

        {skills.length === 0 && (
          <Card className="glass">
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">
                No skills yet. Add your first skill above.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
