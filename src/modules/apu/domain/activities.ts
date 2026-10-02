export type ApuActivity = { name: string; unit: string; group: string };

export const apuActivities: ApuActivity[] = [
  /* ── 1. Preliminares ── */
  { group: "Preliminares", name: "Localización y replanteo topográfico", unit: "m²" },
  { group: "Preliminares", name: "Cerramiento provisional de obra", unit: "m" },
  { group: "Preliminares", name: "Campamento y señalización de obra", unit: "gl" },
  { group: "Preliminares", name: "Limpieza y descapote manual", unit: "m²" },
  { group: "Preliminares", name: "Demolición de concreto", unit: "m³" },
  { group: "Preliminares", name: "Demolición de muro", unit: "m²" },

  /* ── 2. Movimiento de tierras ── */
  { group: "Movimiento de tierras", name: "Excavación manual", unit: "m³" },
  { group: "Movimiento de tierras", name: "Excavación mecánica para zanja", unit: "m³" },
  { group: "Movimiento de tierras", name: "Relleno compactado con material seleccionado", unit: "m³" },
  { group: "Movimiento de tierras", name: "Retiro y disposición de sobrantes", unit: "m³" },
  { group: "Movimiento de tierras", name: "Apertura de zanja para oleoducto", unit: "m³" },

  /* ── 3. Tubería y Oleoductos ── */
  { group: "Tubería y Oleoductos", name: "Tendido y alineación de tubería de acero", unit: "m" },
  { group: "Tubería y Oleoductos", name: "Biselado y presentación de juntas de tubería", unit: "junta" },
  { group: "Tubería y Oleoductos", name: "Bajada de tubería a zanja con Sideboom", unit: "m" },
  { group: "Tubería y Oleoductos", name: "Prueba hidrostática de línea de tubería", unit: "km" },
  { group: "Tubería y Oleoductos", name: "Limpieza y paso de raspadores (Pigs/Scrapers)", unit: "pase" },
  { group: "Tubería y Oleoductos", name: "Torque calibrado de uniones bridadas (Hytorc)", unit: "brida" },
  { group: "Tubería y Oleoductos", name: "Instalación de válvulas de seccionamiento de alta presión", unit: "und" },
  { group: "Tubería y Oleoductos", name: "Cruce subfluvial o especial de tubería", unit: "m" },

  /* ── 4. Soldadura y Ensayos ── */
  { group: "Soldadura y Ensayos", name: "Soldadura API 1104 en línea (Pase de raíz celulósico)", unit: "pulg-diam" },
  { group: "Soldadura y Ensayos", name: "Soldadura SMAW para estructuras metálicas (3G/4G)", unit: "m" },
  { group: "Soldadura y Ensayos", name: "Soldadura GTAW / TIG en acero inoxidable y alta pureza", unit: "pulg-diam" },
  { group: "Soldadura y Ensayos", name: "Esmerilado y limpieza interpase de cordones", unit: "junta" },
  { group: "Soldadura y Ensayos", name: "Inspección radiográfica y END de juntas soldadas", unit: "junta" },

  /* ── 5. Metalmecánica y Montaje ── */
  { group: "Metalmecánica", name: "Fabricación e instalación de estructura metálica", unit: "kg" },
  { group: "Metalmecánica", name: "Fabricación e izaje de chimenea industrial", unit: "kg" },
  { group: "Metalmecánica", name: "Montaje de pasarelas y plataformas de inspección", unit: "m²" },
  { group: "Metalmecánica", name: "Fabricación de soportes tipo cuna para tubería", unit: "und" },
  { group: "Metalmecánica", name: "Fabricación e instalación de baranda metálica", unit: "m" },
  { group: "Metalmecánica", name: "Montaje y alineación láser de motobomba centrífuga", unit: "und" },

  /* ── 6. Tratamiento Superficial y Pintura ── */
  { group: "Pintura y Sandblasting", name: "Limpieza con chorro abrasivo Sandblasting SSPC-SP10", unit: "m²" },
  { group: "Pintura y Sandblasting", name: "Limpieza con chorro abrasivo a metal blanco SSPC-SP5", unit: "m²" },
  { group: "Pintura y Sandblasting", name: "Aplicación de imprimante rico en zinc (Inorgánico/Epóxico)", unit: "m²" },
  { group: "Pintura y Sandblasting", name: "Aplicación de recubrimiento epóxico de altos sólidos", unit: "m²" },
  { group: "Pintura y Sandblasting", name: "Aplicación de acabado poliuretano alifático", unit: "m²" },
  { group: "Pintura y Sandblasting", name: "Pintura anticorrosiva de estructura metálica", unit: "m²" },
  { group: "Pintura y Sandblasting", name: "Revestimiento de juntas con manta termocontraíble", unit: "junta" },

  /* ── 7. Concreto y Estructuras Civiles ── */
  { group: "Concreto", name: "Concreto de limpieza 2000 psi", unit: "m³" },
  { group: "Concreto", name: "Concreto para zapatas 3000 psi", unit: "m³" },
  { group: "Concreto", name: "Concreto para vigas y columnas 3000 psi", unit: "m³" },
  { group: "Concreto", name: "Dados y pedestales de concreto para soportes de tubería", unit: "m³" },
  { group: "Concreto", name: "Acero de refuerzo figurado e instalado", unit: "kg" },
  { group: "Concreto", name: "Formaleta para concreto", unit: "m²" },

  /* ── 8. Mampostería y Acabados ── */
  { group: "Mampostería", name: "Muro en bloque de cemento", unit: "m²" },
  { group: "Mampostería", name: "Muro en ladrillo estructural", unit: "m²" },
  { group: "Mampostería", name: "Pañete liso de muros", unit: "m²" },
  { group: "Mampostería", name: "Estuco y pintura de muros", unit: "m²" },
  { group: "Pisos y acabados", name: "Piso en concreto afinado", unit: "m²" },
  { group: "Pisos y acabados", name: "Enchape cerámico de piso", unit: "m²" },
  { group: "Pisos y acabados", name: "Enchape cerámico de muro", unit: "m²" },

  /* ── 9. Cubiertas ── */
  { group: "Cubiertas", name: "Estructura metálica para cubierta", unit: "kg" },
  { group: "Cubiertas", name: "Suministro e instalación de teja termoacústica", unit: "m²" },
  { group: "Cubiertas", name: "Canal y bajante de aguas lluvias", unit: "m" },

  /* ── 10. Andamios y Obras de Acceso ── */
  { group: "Andamiaje", name: "Armado y desmonte de andamio multidireccional certificado Layher", unit: "m³" },
  { group: "Andamiaje", name: "Montaje de andamio colgante o voladizo para chimenea", unit: "gl" },

  /* ── 11. Eléctricas e Instrumentación ── */
  { group: "Eléctricas", name: "Punto eléctrico de iluminación", unit: "und" },
  { group: "Eléctricas", name: "Punto eléctrico de tomacorriente", unit: "und" },
  { group: "Eléctricas", name: "Canalización eléctrica PVC", unit: "m" },
  { group: "Eléctricas", name: "Tendido de tubería conduit galvanizada para áreas clasificadas", unit: "m" },
  { group: "Eléctricas", name: "Tablero eléctrico y protecciones", unit: "und" },
  { group: "Eléctricas", name: "Tendido de cable de potencia en bandeja / zanja", unit: "m" },
  { group: "Eléctricas", name: "Malla de puesta a tierra y pruebas de resistividad", unit: "gl" },
  { group: "Instrumentación", name: "Instalación de soportería y tubing de acero inoxidable para instrumentos", unit: "m" },
  { group: "Instrumentación", name: "Montaje, conexión y calibración de transmisor de presión/flujo", unit: "und" },

  /* ── 12. Hidrosanitarias ── */
  { group: "Hidrosanitarias", name: "Punto hidráulico de agua fría", unit: "und" },
  { group: "Hidrosanitarias", name: "Punto sanitario PVC", unit: "und" },
  { group: "Hidrosanitarias", name: "Instalación de sanitario", unit: "und" },
  { group: "Hidrosanitarias", name: "Instalación de lavamanos", unit: "und" },

  /* ── 13. Vías, Exteriores y Ambiental ── */
  { group: "Vías y exteriores", name: "Subbase granular compactada", unit: "m³" },
  { group: "Vías y exteriores", name: "Placa huella en concreto", unit: "m²" },
  { group: "Vías y exteriores", name: "Andén en concreto", unit: "m²" },
  { group: "Ambiental y SST", name: "Plan de manejo de residuos de obra (RESPEL)", unit: "gl" },
  { group: "Ambiental y SST", name: "Señalización y demarcación de seguridad industrial", unit: "gl" },
];
