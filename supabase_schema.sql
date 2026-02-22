-- =====================================================
-- AI PORTFOLIO - SUPABASE DATABASE SCHEMA
-- =====================================================
-- This schema powers the two-frontend architecture:
-- 1. Admin Canvas (/admin) - Visual management interface
-- 2. Public Portfolio (/) - Visitor-facing showcase
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLE: projects
-- Stores all portfolio projects with rich content
-- =====================================================
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    cover_image TEXT,
    tags TEXT[] DEFAULT '{}',
    github_url TEXT,
    demo_url TEXT,
    display_order INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster ordering
CREATE INDEX idx_projects_order ON projects(display_order);
CREATE INDEX idx_projects_published ON projects(is_published);

-- =====================================================
-- TABLE: skills
-- Stores skills/categories for tagging projects
-- =====================================================
CREATE TABLE skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    category TEXT DEFAULT 'technical',
    color TEXT DEFAULT '#3b82f6',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE: settings
-- Global portfolio settings (resume, bio, contact)
-- =====================================================
CREATE TABLE settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE: project_images
-- Additional images for projects (gallery)
-- =====================================================
CREATE TABLE project_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    caption TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- STORAGE BUCKETS
-- =====================================================
-- Create storage buckets for file uploads
INSERT INTO storage.buckets (id, name, public) 
VALUES 
    ('project-covers', 'project-covers', true),
    ('project-gallery', 'project-gallery', true),
    ('resume', 'resume', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for public read access
CREATE POLICY "Public can view project covers" 
    ON storage.objects FOR SELECT 
    USING (bucket_id = 'project-covers');

CREATE POLICY "Public can view project gallery" 
    ON storage.objects FOR SELECT 
    USING (bucket_id = 'project-gallery');

CREATE POLICY "Public can view resume" 
    ON storage.objects FOR SELECT 
    USING (bucket_id = 'resume');

-- Storage policies for admin write access (authenticated users)
CREATE POLICY "Authenticated users can upload project covers" 
    ON storage.objects FOR INSERT 
    TO authenticated 
    WITH CHECK (bucket_id = 'project-covers');

CREATE POLICY "Authenticated users can upload project gallery" 
    ON storage.objects FOR INSERT 
    TO authenticated 
    WITH CHECK (bucket_id = 'project-gallery');

CREATE POLICY "Authenticated users can upload resume" 
    ON storage.objects FOR INSERT 
    TO authenticated 
    WITH CHECK (bucket_id = 'resume');

CREATE POLICY "Authenticated users can delete project covers" 
    ON storage.objects FOR DELETE 
    TO authenticated 
    USING (bucket_id = 'project-covers');

CREATE POLICY "Authenticated users can delete project gallery" 
    ON storage.objects FOR DELETE 
    TO authenticated 
    USING (bucket_id = 'project-gallery');

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================
-- Enable RLS on all tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_images ENABLE ROW LEVEL SECURITY;

-- Projects: Public can read published, admin can do everything
CREATE POLICY "Public can view published projects" 
    ON projects FOR SELECT 
    USING (is_published = true);

CREATE POLICY "Authenticated users can manage projects" 
    ON projects FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

-- Skills: Public can read, admin can manage
CREATE POLICY "Public can view skills" 
    ON skills FOR SELECT 
    TO anon, authenticated 
    USING (true);

CREATE POLICY "Authenticated users can manage skills" 
    ON skills FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

-- Settings: Public can read, admin can manage
CREATE POLICY "Public can view settings" 
    ON settings FOR SELECT 
    TO anon, authenticated 
    USING (true);

CREATE POLICY "Authenticated users can manage settings" 
    ON settings FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

-- Project Images: Public can read, admin can manage
CREATE POLICY "Public can view project images" 
    ON project_images FOR SELECT 
    TO anon, authenticated 
    USING (true);

CREATE POLICY "Authenticated users can manage project images" 
    ON project_images FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================
-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_projects_updated_at 
    BEFORE UPDATE ON projects 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at 
    BEFORE UPDATE ON settings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SEED DATA
-- =====================================================
-- Insert default skills
INSERT INTO skills (name, category, color) VALUES
    ('Python', 'technical', '#3776ab'),
    ('PyTorch', 'technical', '#ee4c2c'),
    ('TensorFlow', 'technical', '#ff6f00'),
    ('SQL', 'technical', '#336791'),
    ('Machine Learning', 'technical', '#00d4aa'),
    ('Deep Learning', 'technical', '#8b5cf6'),
    ('Computer Vision', 'technical', '#ec4899'),
    ('NLP', 'technical', '#10b981'),
    ('Data Science', 'technical', '#f59e0b'),
    ('React', 'technical', '#61dafb'),
    ('TypeScript', 'technical', '#3178c6'),
    ('UI/UX', 'design', '#f43f5e')
ON CONFLICT (name) DO NOTHING;

-- Insert default settings
INSERT INTO settings (key, value) VALUES
    ('bio', 'Data Scientist and AI Engineer passionate about building intelligent systems that solve real-world problems.'),
    ('contact_email', 'your.email@example.com'),
    ('resume_url', ''),
    ('linkedin_url', ''),
    ('github_url', ''),
    ('twitter_url', ''),
    ('site_title', 'AI Portfolio'),
    ('site_description', 'Portfolio of a Data Scientist & AI Engineer')
ON CONFLICT (key) DO NOTHING;

-- Insert sample project
INSERT INTO projects (slug, title, description, cover_image, tags, github_url, demo_url, display_order, is_published)
VALUES (
    'vision-language-model-comparison',
    'Vision-Language Model Comparison',
    '<h2>Overview</h2><p>This project compares state-of-the-art vision-language models including CLIP, BLIP, and LLaVA on various benchmarks.</p><h3>Key Features</h3><ul><li>Comprehensive benchmark evaluation</li><li>Zero-shot classification performance</li><li>Image-text retrieval metrics</li></ul><h3>Results</h3><p>Our analysis shows that CLIP excels in zero-shot tasks while BLIP performs better on fine-tuned downstream applications.</p>',
    'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800',
    ARRAY['Python', 'PyTorch', 'Computer Vision', 'Deep Learning'],
    'https://github.com/yourusername/vlm-comparison',
    'https://vlm-demo.vercel.app',
    1,
    true
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO projects (slug, title, description, cover_image, tags, github_url, demo_url, display_order, is_published)
VALUES (
    'adhd-detection-ml',
    'ADHD Detection using ML',
    '<h2>Overview</h2><p>Machine learning system for early detection of ADHD using behavioral data and cognitive test results.</p><h3>Methodology</h3><p>We employed ensemble methods combining Random Forest, XGBoost, and Neural Networks to achieve high accuracy in classification.</p><h3>Impact</h3><p>The model achieved 94% accuracy on the test set and is being piloted in clinical settings.</p>',
    'https://images.unsplash.com/photo-1559757175-0eb30cd8c063?w=800',
    ARRAY['Python', 'Machine Learning', 'Data Science', 'SQL'],
    'https://github.com/yourusername/adhd-detection',
    '',
    2,
    true
)
ON CONFLICT (slug) DO NOTHING;
