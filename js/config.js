/* PitStop Lava Jato — configuração (única coisa que você precisa editar para publicar) */
window.PITSTOP = {
  /* 1) Supabase: Project Settings → API (use a chave "anon"/"publishable", NUNCA a service_role) */
 SUPABASE_URL: 'https://chochoxunojujiulqmoc.supabase.co',
 SUPABASE_ANON_KEY: 'sb_publishable_VJDTJWhMDtz5NfBQKXXjEw_2GNxK8ZR',

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

  /* Valores de reserva (usados só se o banco estiver inacessível; o preço oficial vem do banco) */
  SERVICES: [
    { id: "moto",          vehicle: "moto",  name: "Lavagem de moto",           price: 35, description: "Lavagem da sua moto." },
    { id: "carro-cera",    vehicle: "carro", name: "Lavagem completa com cera", price: 65, description: "Lavagem externa, aspiração interna, limpeza do painel e cera." },
    { id: "carro-simples", vehicle: "carro", name: "Lavagem sem cera",          price: 45, description: "Lavagem externa, aspiração interna e limpeza do painel." }
  ],

  /* Galeria "Nosso trabalho": para adicionar fotos, coloque o arquivo em /assets e inclua uma linha aqui.
     w/h = tamanho real da imagem (preserva a proporção sem cortes). */
  GALLERY: [
    { src: "assets/moto-honda.jpg",      thumb: "assets/moto-honda-thumb.jpg",      w: 575, h: 1280, tag: "Moto",  alt: "Moto Honda preta, limpa e brilhando após a lavagem" },
    { src: "assets/carro-suv-prata.jpg", thumb: "assets/carro-suv-prata-thumb.jpg", w: 575, h: 1280, tag: "Carro", alt: "SUV prata com lanterna acesa após a lavagem" },
    { src: "assets/carro-cinza.jpg",     thumb: "assets/carro-cinza-thumb.jpg",     w: 575, h: 1280, tag: "Carro", alt: "Carro cinza com pintura brilhante e rodas limpas" }
  ]
};
