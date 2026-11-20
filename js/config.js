/* PitStop Lava Jato — configuração (única coisa que você precisa editar para publicar) */
window.PITSTOP = {
  /* 1) Supabase: Project Settings → API (use a chave "anon"/"publishable", NUNCA a service_role) */
  SUPABASE_URL: "https://SEU-PROJETO.supabase.co",
  SUPABASE_ANON_KEY: "SUA-CHAVE-ANON-OU-PUBLISHABLE",

  /* 2) WhatsApp do PitStop (somente dígitos, com DDI 55 + DDD).
        Informado: +55 81 9891-9952. Se o WhatsApp não abrir a conversa, confira se
        o número tem o 9 extra de celular: 5581998919952 */
  WHATSAPP: "558198919952",
  WHATSAPP_DISPLAY: "(81) 9891-9952",

  /* 3) Regras de funcionamento (devem coincidir com supabase/schema.sql → business_slots) */
  TZ: "America/Recife",
  MAX_DAYS_AHEAD: 60,
  OPEN_DAYS: [1, 2, 3, 4, 5, 6],                       // seg–sáb (0 = domingo)
  SLOTS: ["08:00","09:00","10:00","11:00","13:00","14:00","15:00","16:00"], // 1h cada; almoço 12–13h

  /* Serviços (reserva local). O preço e a descrição oficiais vêm do banco (tabela services / painel → Ajustes).
     Em "description", cada linha é um item do que é feito na lavagem. */
  SERVICES: [
    { id: "carro-cera",    vehicle: "carro", name: "Lavagem completa com cera", price: 65, description: "Lavagem externa\nAspiração interna\nLimpeza do painel\nAplicação de cera" },
    { id: "carro-simples", vehicle: "carro", name: "Lavagem sem cera",          price: 45, description: "Lavagem externa\nAspiração interna\nLimpeza do painel" },
    { id: "moto-cera",     vehicle: "moto",  name: "Lavagem completa com cera", price: 50, description: "Lavagem\nRestaurador para os plásticos\nAplicação de cera Vonixx com 3 meses de proteção\nSelante para pneus" },
    { id: "moto",          vehicle: "moto",  name: "Lavagem sem cera",          price: 35, description: "Lavagem\nPretinho nos pneus" }
  ],

  /* Foto de cada serviço nos cards (use fotos em pé, proporção 9:20) */
  SERVICE_PHOTOS: {
    "carro-cera":    { src: "assets/galeria/carro-hyundai-rodas-thumb.jpg", alt: "Carro cinza com roda limpa e pneu pretinho" },
    "carro-simples": { src: "assets/galeria/carro-ka-branco-thumb.jpg",     alt: "Carro branco limpo após a lavagem" },
    "moto-cera":     { src: "assets/galeria/moto-royal-enfield-thumb.jpg",  alt: "Moto preta com escapamento cromado e tanque espelhado" },
    "moto":          { src: "assets/galeria/moto-fan-vermelha-thumb.jpg",   alt: "Moto vermelha limpa após a lavagem" }
  },

  /* Galeria "Nosso trabalho": para adicionar fotos, coloque o arquivo em /assets/galeria e inclua uma linha aqui.
     w/h = tamanho real da imagem (a proporção é preservada, sem cortes). A foto grande da página inicial é HERO_PHOTO. */
  GALLERY: [
    {"src": "assets/galeria/carro-jeep-azul.jpg", "thumb": "assets/galeria/carro-jeep-azul-thumb.jpg", "w": 1449, "h": 2576, "tag": "Carro", "alt": "SUV azul escuro com pintura brilhando e rodas limpas após a lavagem"},
    {"src": "assets/galeria/moto-royal-enfield.jpg", "thumb": "assets/galeria/moto-royal-enfield-thumb.jpg", "w": 1157, "h": 2576, "tag": "Moto", "alt": "Moto preta com escapamento cromado e tanque espelhado após a lavagem"},
    {"src": "assets/galeria/carro-hb20-prata.jpg", "thumb": "assets/galeria/carro-hb20-prata-thumb.jpg", "w": 1932, "h": 2576, "tag": "Carro", "alt": "Carro cinza com pintura brilhante refletindo o céu após a lavagem"},
    {"src": "assets/galeria/moto-fan-vermelha.jpg", "thumb": "assets/galeria/moto-fan-vermelha-thumb.jpg", "w": 1157, "h": 2576, "tag": "Moto", "alt": "Moto vermelha limpa, com pneus e escapamento tratados"},
    {"src": "assets/galeria/carro-ecosport-preta.jpg", "thumb": "assets/galeria/carro-ecosport-preta-thumb.jpg", "w": 1449, "h": 2576, "tag": "Carro", "alt": "SUV preto com pintura espelhada e pneus pretinhos após a lavagem"},
    {"src": "assets/galeria/moto-bros-azul.jpg", "thumb": "assets/galeria/moto-bros-azul-thumb.jpg", "w": 1932, "h": 2576, "tag": "Moto", "alt": "Moto de trail branca e azul limpa e brilhando"},
    {"src": "assets/galeria/carro-sedan-branco.jpg", "thumb": "assets/galeria/carro-sedan-branco-thumb.jpg", "w": 1449, "h": 2576, "tag": "Carro", "alt": "Carro branco limpo, com pintura brilhante e rodas limpas"},
    {"src": "assets/galeria/moto-cg160-preta.jpg", "thumb": "assets/galeria/moto-cg160-preta-thumb.jpg", "w": 1157, "h": 2576, "tag": "Moto", "alt": "Moto preta limpa com pneus e plásticos tratados"},
    {"src": "assets/galeria/carro-onix-vermelho.jpg", "thumb": "assets/galeria/carro-onix-vermelho-thumb.jpg", "w": 1157, "h": 2576, "tag": "Carro", "alt": "Carro vinho com pintura brilhando e lanterna refletindo"},
    {"src": "assets/galeria/moto-bros-cinza.jpg", "thumb": "assets/galeria/moto-bros-cinza-thumb.jpg", "w": 1157, "h": 2576, "tag": "Moto", "alt": "Moto de trail cinza com rodas raiadas limpas"},
    {"src": "assets/galeria/carro-hyundai-rodas.jpg", "thumb": "assets/galeria/carro-hyundai-rodas-thumb.jpg", "w": 1157, "h": 2576, "tag": "Carro", "alt": "Carro cinza com roda de liga limpa e pneu pretinho"},
    {"src": "assets/galeria/carro-ka-branco.jpg", "thumb": "assets/galeria/carro-ka-branco-thumb.jpg", "w": 1157, "h": 2576, "tag": "Carro", "alt": "Carro branco limpo com rodas pretas após a lavagem"},
    {"src": "assets/galeria/carro-hyundai-frente.jpg", "thumb": "assets/galeria/carro-hyundai-frente-thumb.jpg", "w": 1157, "h": 2576, "tag": "Carro", "alt": "Carro cinza com pintura polida e reflexos nítidos"}
  ],
  HERO_PHOTO: "assets/galeria/carro-jeep-azul.jpg"  /* precisa ser igual ao "src" de uma foto da lista acima */
};
