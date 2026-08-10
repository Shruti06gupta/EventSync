/**
 * Utility helper to determine if Event images are valid,
 * or if they are generic platform/logo placeholders that should be
 * replaced with a deterministic event-specific illustration.
 */

const IMAGE_POOLS = {
  cloud: [
    'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1600132806370-bf17e65e942f?auto=format&fit=crop&w=800&q=80',
  ],
  cyber: [
    'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=80',
  ],
  ai: [
    'https://images.unsplash.com/photo-1677442136019-21780efad99a?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=800&q=80',
  ],
  blockchain: [
    'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1557838923-2985c318be48?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=800&q=80',
  ],
  data: [
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=800&q=80',
  ],
  design: [
    'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=800&q=80',
  ],
  web: [
    'https://images.unsplash.com/photo-1547658719-da2b81169b7a?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=800&q=80',
  ],
  business: [
    'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80',
  ],
  health: [
    'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=800&q=80',
  ],
  hackathon: [
    'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1557838923-2985c318be48?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&q=80',
  ],
  general: [
    'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=800&q=80',
  ],
};

const getStableIndex = (text, size) => {
  if (!size) return 0;

  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }

  return hash % size;
};

const pickImage = (pool, text) => pool[getStableIndex(text, pool.length)];

const normalizeText = (title = '', organizer = '', category = '', source = '') =>
  `${title} ${organizer} ${category} ${source}`.toLowerCase();

export const mapCategoryToImage = (title = '', organizer = '', category = '', source = '') => {
  const text = normalizeText(title, organizer, category, source);

  if (text.includes('google cloud') || text.includes('gcp') || text.includes('google-cloud')) {
    return pickImage(IMAGE_POOLS.cloud, text);
  }
  if (text.includes('aws') || text.includes('amazon') || text.includes('s3') || text.includes('dynamodb') || text.includes('lambda')) {
    return pickImage(IMAGE_POOLS.cloud, text);
  }
  if (text.includes('azure') || text.includes('microsoft') || text.includes('cloud') || text.includes('devops')) {
    return pickImage(IMAGE_POOLS.cloud, text);
  }
  if (text.includes('cyber') || text.includes('security') || text.includes('ethical') || text.includes('hacking') || text.includes('cryptography') || text.includes('ctf')) {
    return pickImage(IMAGE_POOLS.cyber, text);
  }
  if (text.includes('ai') || text.includes('intelligence') || text.includes('machine learning') || text.includes('ml') || text.includes('workshop') || text.includes('generative') || text.includes('gemini') || text.includes('gpt') || text.includes('openai') || text.includes('neuron') || text.includes('neural') || text.includes('deep learning')) {
    return pickImage(IMAGE_POOLS.ai, text);
  }
  if (text.includes('blockchain') || text.includes('web3') || text.includes('solidity') || text.includes('ethereum') || text.includes('crypto') || text.includes('bitcoin') || text.includes('nft')) {
    return pickImage(IMAGE_POOLS.blockchain, text);
  }
  if (text.includes('data') || text.includes('database') || text.includes('sql') || text.includes('analytics') || text.includes('science') || text.includes('python') || text.includes('excel') || text.includes('visualization')) {
    return pickImage(IMAGE_POOLS.data, text);
  }
  if (text.includes('finance') || text.includes('fintech') || text.includes('money') || text.includes('trading') || text.includes('stock') || text.includes('investment') || text.includes('portfolio') || text.includes('wealth') || text.includes('startup')) {
    return pickImage(IMAGE_POOLS.business, text);
  }
  if (text.includes('wellness') || text.includes('health') || text.includes('fitness') || text.includes('yoga') || text.includes('meditation') || text.includes('mental')) {
    return pickImage(IMAGE_POOLS.health, text);
  }
  if (text.includes('art') || text.includes('design') || text.includes('figma') || text.includes('creative') || text.includes('ui') || text.includes('ux') || text.includes('painting') || text.includes('adobe') || text.includes('drawing') || text.includes('sketch') || text.includes('poster')) {
    return pickImage(IMAGE_POOLS.design, text);
  }
  if (text.includes('web') || text.includes('frontend') || text.includes('backend') || text.includes('react') || text.includes('full stack') || text.includes('node') || text.includes('javascript') || text.includes('html') || text.includes('css')) {
    return pickImage(IMAGE_POOLS.web, text);
  }
  if (text.includes('hackathon') || text.includes('code') || text.includes('coding') || text.includes('developer') || text.includes('programming') || text.includes('challenge') || text.includes('compete') || text.includes('competition') || text.includes('algorithm') || text.includes('dsa')) {
    return pickImage(IMAGE_POOLS.hackathon, text);
  }

  return pickImage(IMAGE_POOLS.general, text);
};

export const isInvalidImage = (url) => {
  if (!url) return true;
  const lower = url.toLowerCase();

  if (lower.includes('picsum.photos')) return true;
  if (lower.includes('avatar') || lower.includes('profile') || lower.includes('user') || lower.includes('student') || lower.includes('member') || lower.includes('registrant') || lower.includes('logo') || lower.includes('brand') || lower.includes('favicon')) {
    return true;
  }
  if (!lower.startsWith('http://') && !lower.startsWith('https://')) return true;

  return false;
};

export const getEventImage = (image, title, organizer, category, source = '') => {
  if (isInvalidImage(image)) {
    return mapCategoryToImage(title, organizer, category, source);
  }
  return image;
};
