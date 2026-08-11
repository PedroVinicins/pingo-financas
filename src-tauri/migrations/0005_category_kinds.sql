ALTER TABLE categories
ADD COLUMN kind TEXT NOT NULL DEFAULT 'expense'
CHECK (kind IN ('income', 'expense'));

INSERT OR IGNORE INTO categories (id, kind, name, icon, color, created_at) VALUES
('8d4c8dd6-5fd6-4ec3-9d3f-6c79c1d42805', 'expense', 'Saúde', 'heart-pulse', '#E11D48', CURRENT_TIMESTAMP),
('8d4c8dd6-5fd6-4ec3-9d3f-6c79c1d42806', 'expense', 'Educação', 'graduation-cap', '#0891B2', CURRENT_TIMESTAMP),
('8d4c8dd6-5fd6-4ec3-9d3f-6c79c1d42807', 'expense', 'Contas', 'receipt-text', '#CA8A04', CURRENT_TIMESTAMP),
('8d4c8dd6-5fd6-4ec3-9d3f-6c79c1d42808', 'expense', 'Compras', 'shopping-bag', '#DB2777', CURRENT_TIMESTAMP),
('8d4c8dd6-5fd6-4ec3-9d3f-6c79c1d42811', 'income', 'Salário', 'badge-dollar-sign', '#059669', CURRENT_TIMESTAMP),
('8d4c8dd6-5fd6-4ec3-9d3f-6c79c1d42812', 'income', 'Freelance', 'laptop', '#0D9488', CURRENT_TIMESTAMP),
('8d4c8dd6-5fd6-4ec3-9d3f-6c79c1d42813', 'income', 'Trabalho extra', 'briefcase-business', '#2563EB', CURRENT_TIMESTAMP),
('8d4c8dd6-5fd6-4ec3-9d3f-6c79c1d42814', 'income', 'Vendas', 'store', '#7C3AED', CURRENT_TIMESTAMP),
('8d4c8dd6-5fd6-4ec3-9d3f-6c79c1d42815', 'income', 'Benefícios', 'gift', '#EA580C', CURRENT_TIMESTAMP),
('8d4c8dd6-5fd6-4ec3-9d3f-6c79c1d42816', 'income', 'Rendimentos', 'trending-up', '#16A34A', CURRENT_TIMESTAMP),
('8d4c8dd6-5fd6-4ec3-9d3f-6c79c1d42817', 'income', 'Outras entradas', 'circle-dollar-sign', '#475569', CURRENT_TIMESTAMP);
