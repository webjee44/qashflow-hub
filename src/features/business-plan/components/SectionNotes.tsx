import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { MessageSquare, ChevronDown, ChevronUp, Save, Loader2 } from 'lucide-react';
import { useBPNotes, BPSection } from '@/hooks/useBPNotes';
import { cn } from '@/lib/utils';

interface SectionNotesProps {
  section: BPSection;
  title?: string;
  placeholder?: string;
  className?: string;
}

export function SectionNotes({ section, title = 'Notes', placeholder = 'Ajoutez vos hypothèses, commentaires ou remarques...', className }: SectionNotesProps) {
  const { getNote, saveNote, isLoading } = useBPNotes();
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const note = getNote(section);
    setContent(note);
  }, [section, getNote]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveNote.mutateAsync({ section, content });
      setHasChanges(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (value: string) => {
    setContent(value);
    setHasChanges(true);
  };

  const hasContent = content.trim().length > 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <Card className={cn(
        "border-dashed transition-colors",
        hasContent ? "border-primary/30 bg-primary/5" : "border-muted"
      )}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className={cn(
                  "h-4 w-4",
                  hasContent ? "text-primary" : "text-muted-foreground"
                )} />
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                {hasContent && !isOpen && (
                  <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                    {content.substring(0, 50)}...
                  </span>
                )}
              </div>
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3">
            <Textarea
              value={content}
              onChange={(e) => handleChange(e.target.value)}
              placeholder={placeholder}
              rows={4}
              className="resize-none"
            />
            {hasChanges && (
              <div className="flex justify-end">
                <Button 
                  size="sm" 
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Enregistrer
                </Button>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
