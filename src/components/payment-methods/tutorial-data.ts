export type PaymentMethodTutorialKey = "binance" | "airtm" | "banco-qr";

type TutorialError = {
  title: string;
  description: string;
};

type TutorialSourceLink = {
  label: string;
  url: string;
};

type MobileGuideSection = {
  title: string;
  steps: string[];
};

export type PaymentMethodTutorial = {
  key: PaymentMethodTutorialKey;
  name: string;
  path: `/payment-methods/${string}`;
  shortDescription: string;
  prerequisites: string[];
  mobilePrerequisiteSteps: MobileGuideSection[];
  jnodeFieldGuide: string[];
  mobileNotes: string[];
  sourceLinks: TutorialSourceLink[];
  steps: string[];
  commonErrors: TutorialError[];
  tips: string[];
};

export const PAYMENT_METHOD_TUTORIALS: Record<
  PaymentMethodTutorialKey,
  PaymentMethodTutorial
> = {
  binance: {
    key: "binance",
    name: "Binance",
    path: "/payment-methods/binance",
    shortDescription:
      "Configura tu ID de Binance y sube un codigo QR valido para recibir pagos y retiros sin friccion.",
    prerequisites: [
      "Tener una cuenta activa de Binance y acceso al panel de pagos.",
      "Identificar tu Binance ID exacto sin espacios ni caracteres extra.",
      "Generar una imagen QR legible en formato PNG, JPG o WEBP.",
    ],
    mobilePrerequisiteSteps: [
      {
        title: "Obtener tu Binance ID desde el movil",
        steps: [
          "Abre la app de Binance en tu telefono e inicia sesion.",
          "Toca el icono de Perfil en la esquina superior izquierda.",
          "Si estas en Binance Lite, cambia a Binance Pro para ver mas opciones.",
          "Ubica tu User ID en la parte superior y copialo con el icono de copiar.",
        ],
      },
      {
        title: "Generar tu QR de cobro en Binance Pay",
        steps: [
          "En la app, entra a Pay (icono superior derecho o menu Pay).",
          "Selecciona la opcion Receive para cobrar.",
          "Genera el QR para recibir activos y valida que sea tu cuenta.",
          "Guarda la imagen del QR en galeria para luego subirla en la aplicacion.",
        ],
      },
    ],
    jnodeFieldGuide: [
      "Pega tu User ID en el campo ID de Binance.",
      "Sube la imagen guardada al campo Codigo QR.",
      "Activa Habilitado si quieres usarlo de inmediato.",
    ],
    mobileNotes: [
      "Los nombres de menu pueden variar segun version de app, pais o idioma.",
      "No compartas capturas donde aparezcan datos sensibles de cuenta.",
    ],
    sourceLinks: [
      {
        label: "Binance.US - How to find your user ID",
        url: "https://support.binance.us/hc/en-us/articles/360053887114-How-Do-I-Find-My-User-ID",
      },
      {
        label: "Guia de comunidad - Binance User ID y Pay ID (mobile)",
        url: "https://www.decentralizedcreator.com/find-binance-user-id-and-pay-id/",
      },
    ],
    steps: [
      "Abre Settings > Metodos de pago y selecciona Binance.",
      "Completa el campo ID de Binance tal como aparece en tu cuenta.",
      "Adjunta la imagen QR y valida que la vista previa sea correcta.",
      "Define si deseas dejar el metodo habilitado al guardar.",
      "Guarda y confirma que aparezca como Configurado en el listado.",
    ],
    commonErrors: [
      {
        title: "ID de Binance incompleto",
        description:
          "Si el ID no coincide exactamente con el de tu cuenta, los pagos pueden quedar rechazados.",
      },
      {
        title: "QR borroso o recortado",
        description:
          "Una imagen de baja calidad dificulta escaneo y aumenta incidencias en cobro.",
      },
      {
        title: "Metodo deshabilitado",
        description:
          "Aunque este configurado, no estara disponible si el switch de habilitado queda en falso.",
      },
    ],
    tips: [
      "Verifica el QR desde otro dispositivo antes de guardar.",
      "Evita editar manualmente la imagen para no alterar la lectura.",
      "Si cambias de cuenta, actualiza ID y QR en la misma sesion.",
    ],
  },
  airtm: {
    key: "airtm",
    name: "Airtm",
    path: "/payment-methods/airtm",
    shortDescription:
      "Registra tu cuenta ACH (titular, routing, cuenta, banco y tipo) para habilitar retiros en USD.",
    prerequisites: [
      "Contar con los datos ACH oficiales de tu cuenta Airtm.",
      "Confirmar el nombre del titular tal como figura en la cuenta bancaria.",
      "Validar routing number, account number y tipo de cuenta.",
    ],
    mobilePrerequisiteSteps: [
      {
        title: "Habilitar y abrir US Virtual Account",
        steps: [
          "Abre la app de Airtm e inicia sesion en tu cuenta verificada.",
          "Busca la opcion US Virtual Account en el dashboard de la cuenta.",
          "Si no aparece, revisa elegibilidad regional y completa verificacion pendiente.",
          "Si tu cuenta aun no tiene acceso, solicita soporte desde help.airtm.com.",
        ],
      },
      {
        title: "Copiar datos ACH desde el movil",
        steps: [
          "En US Virtual Account, abre Account details.",
          "Copia Account holder, Routing number y Account number.",
          "Verifica dos veces los datos antes de compartir o registrar.",
          "Guarda una nota segura temporal para completar luego en la aplicacion.",
        ],
      },
    ],
    jnodeFieldGuide: [
      "Titular -> campo Titular.",
      "Routing number -> campo Routing number.",
      "Account number -> campo Account number.",
      "Bank name y Account type -> segun detalle mostrado por Airtm o tu cuenta bancaria.",
    ],
    mobileNotes: [
      "La activacion inicial de US Virtual Account puede cambiar por pais y compliance.",
      "En algunas cuentas, parte del onboarding puede redirigir a flujo web.",
    ],
    sourceLinks: [
      {
        label: "Airtm - US Virtual Account",
        url: "https://help.airtm.com/en/support/solutions/articles/47001259147-us-virtual-account",
      },
      {
        label: "Airtm - FAQ US Virtual Account",
        url: "https://help.airtm.com/en/support/solutions/articles/47001265695-frequently-asked-questions-about-airtm-s-us-virtual-account",
      },
    ],
    steps: [
      "Entra a Settings > Metodos de pago y abre Airtm.",
      "Completa Titular, Routing number y Account number sin abreviaciones ambiguas.",
      "Ingresa Banco y Tipo de cuenta segun el dato bancario oficial.",
      "Activa el switch de habilitado para permitir retiros.",
      "Guarda y revisa que el estado quede Configurado y Habilitado.",
    ],
    commonErrors: [
      {
        title: "Routing number invalido",
        description:
          "Un routing incorrecto bloquea transferencias ACH y provoca rechazos bancarios.",
      },
      {
        title: "Titular no coincide",
        description:
          "Diferencias entre titular registrado y cuenta destino generan retenciones o devoluciones.",
      },
      {
        title: "Tipo de cuenta ambiguo",
        description:
          "Definir mal el tipo de cuenta puede direccionar mal la operacion de retiro.",
      },
    ],
    tips: [
      "Copia y pega los datos desde la fuente oficial para evitar errores de digitacion.",
      "Conserva una referencia segura del ultimo formulario guardado.",
      "Haz una validacion cruzada con tu banco antes de habilitar retiros masivos.",
    ],
  },
  "banco-qr": {
    key: "banco-qr",
    name: "Banco QR",
    path: "/payment-methods/banco-qr",
    shortDescription:
      "Configura tus datos bancarios locales y una imagen QR nitida para facilitar cobros nacionales.",
    prerequisites: [
      "Tener banco, titular, CI y numero de cuenta verificados.",
      "Disponer de una imagen QR en buena resolucion (PNG, JPG o WEBP).",
      "Confirmar que el QR corresponde a la cuenta bancaria correcta.",
    ],
    mobilePrerequisiteSteps: [
      {
        title: "Ruta movil sugerida para BNB",
        steps: [
          "Ingresa a Banca Digital BNB y accede a la opcion QR Digital.",
          "Completa los datos requeridos para generar tu codigo QR.",
          "Descarga o guarda el QR generado en tu dispositivo movil.",
          "Verifica que el QR corresponda a la cuenta bancaria correcta.",
        ],
      },
      {
        title: "Ruta movil sugerida para BCP",
        steps: [
          "Abre Banca Movil BCP e ingresa al icono QR.",
          "Selecciona Cobra con QR para generar el codigo de cobro.",
          "Configura monto/moneda si aplica y guarda o comparte el QR.",
          "Si necesitas material comercial, solicita tu QR desde GestionQR/BCP.",
        ],
      },
      {
        title: "Fallback para otros bancos bolivianos",
        steps: [
          "Busca en la app bancaria opciones como QR, Cobros o QR Simple.",
          "Genera o solicita tu QR de cobro asociado a tu cuenta activa.",
          "Confirma banco, titular, CI y numero de cuenta antes de cargar en la aplicacion.",
        ],
      },
    ],
    jnodeFieldGuide: [
      "Banco -> nombre exacto de tu banco.",
      "Titular -> nombre del titular registrado en cuenta.",
      "CI -> documento del titular.",
      "Numero de cuenta -> cuenta bancaria asociada al QR.",
      "Imagen QR -> archivo QR de cobro guardado en tu movil.",
    ],
    mobileNotes: [
      "Las pantallas de QR pueden variar segun banco, version de app y tipo de cuenta.",
      "Si tu app no permite exportar imagen, usa opcion compartir y guardala en galeria.",
    ],
    sourceLinks: [
      {
        label: "BNB - Crea tus codigos QR de forma digital",
        url: "https://bancadigital.bnb.com.bo/SolicitudQRSimple/qr-digital/",
      },
      {
        label: "BCP - Realiza pagos y cobros con QR",
        url: "https://www.bcp.com.bo/QR",
      },
      {
        label: "BCP - Gestion QR",
        url: "https://apppro.bcp.com.bo/GestionQR/",
      },
    ],
    steps: [
      "Abre Settings > Metodos de pago y selecciona Banco QR.",
      "Completa Banco, Titular, CI y Numero de cuenta con datos oficiales.",
      "Adjunta la imagen QR y confirma que la vista previa sea legible.",
      "Activa el metodo si deseas habilitarlo para retiros locales.",
      "Guarda cambios y valida que el metodo aparezca como activo.",
    ],
    commonErrors: [
      {
        title: "CI o cuenta con digitos faltantes",
        description:
          "Un numero incompleto impide conciliar pagos y retrasa la validacion operativa.",
      },
      {
        title: "Imagen QR incorrecta",
        description:
          "Subir un QR de otra cuenta genera cobros fallidos y reclamos de clientes.",
      },
      {
        title: "Datos de banco desactualizados",
        description:
          "Cambios recientes no reflejados en settings pueden provocar transferencias rechazadas.",
      },
    ],
    tips: [
      "Actualiza la informacion inmediatamente si cambias de cuenta bancaria.",
      "Mantiene coherencia entre banco, titular y CI para auditoria interna.",
      "Prueba el QR con una app de lectura antes de habilitarlo.",
    ],
  },
};

export const PAYMENT_METHOD_TUTORIAL_LIST: PaymentMethodTutorial[] = [
  PAYMENT_METHOD_TUTORIALS.binance,
  PAYMENT_METHOD_TUTORIALS.airtm,
  PAYMENT_METHOD_TUTORIALS["banco-qr"],
];
