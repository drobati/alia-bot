-- Create meme_templates table if it doesn't exist
CREATE TABLE IF NOT EXISTS meme_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    url TEXT NOT NULL,
    description TEXT,
    text_positions JSON,
    default_font_size INT DEFAULT 32,
    creator VARCHAR(255) DEFAULT 'system',
    usage_count INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Clear existing templates
DELETE FROM meme_templates WHERE creator = 'system';

-- Insert templates with corrected data
INSERT INTO meme_templates (name, url, description, text_positions, default_font_size, creator, usage_count, is_active) VALUES
('This Is Fine', 'https://i.imgflip.com/26am.jpg', 'Dog sitting in burning room saying this is fine', '[]', 32, 'system', 0, TRUE),
('Ancient Aliens', 'https://i.imgflip.com/26hg.jpg', 'Giorgio Tsoukalos saying aliens', '[]', 32, 'system', 0, TRUE),
('Surprised Pikachu', 'https://i.imgflip.com/2kbn1e.jpg', 'Pikachu with surprised expression', '[]', 32, 'system', 0, TRUE),
('Hide the Pain Harold', 'https://i.imgflip.com/gk5el.jpg', 'Harold hiding his pain with a forced smile', '[]', 32, 'system', 0, TRUE),
('Mocking SpongeBob', 'https://i.imgflip.com/1otk96.jpg', 'SpongeBob mocking someone with alternating caps', '[]', 32, 'system', 0, TRUE),
('Drake Pointing', 'https://i.imgflip.com/30b1gx.jpg', 'Drake pointing at things he likes/dislikes', '[]', 32, 'system', 0, TRUE),
('Distracted Boyfriend', 'https://i.imgflip.com/1ur9b0.jpg', 'Man looking at another woman while girlfriend looks on disapprovingly', '[]', 32, 'system', 0, TRUE),
('Woman Yelling at Cat', 'https://i.imgflip.com/345v97.jpg', 'Woman pointing and yelling with confused cat at dinner table', '[]', 32, 'system', 0, TRUE),
('Expanding Brain', 'https://i.imgflip.com/1jwhww.jpg', 'Four-panel brain expansion meme', '[]', 32, 'system', 0, TRUE),
('Two Buttons', 'https://i.imgflip.com/1g8my4.jpg', 'Person sweating over two button choices', '[]', 32, 'system', 0, TRUE);