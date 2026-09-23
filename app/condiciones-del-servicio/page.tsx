import type { Metadata } from "next";
import { LegalPageLayout, LegalSection } from "@/components/legal-page-layout";
import Link from "next/link";
import { INDEX_ROBOTS } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Condiciones del servicio",
  description: "Condiciones de uso de Citadely para negocios y personas que reservan turnos.",
  robots: INDEX_ROBOTS,
  alternates: { canonical: "/condiciones-del-servicio" },
};

export default function TermsOfServicePage() {
  return (
    <LegalPageLayout
      title="Condiciones del servicio"
      description="Reglas de uso de Citadely para negocios que administran turnos y personas que reservan desde sus páginas públicas."
    >
      <LegalSection title="Qué ofrece Citadely">
        <p>Citadely permite a negocios de servicios organizar agenda, clientes, servicios y disponibilidad. Según el plan contratado, el negocio también puede publicar una página propia para recibir reservas online.</p>
        <p>Citadely proporciona herramientas de gestión. El servicio reservado, su prestación, precio, modalidad y condiciones particulares corresponden al negocio que lo ofrece.</p>
      </LegalSection>

      <LegalSection title="Identificación del titular y contacto">
        <p>Citadely es el nombre público de la plataforma.</p>
        <ul>
          <li><strong>Identificación del titular:</strong> Desarrollado por OnionDEV.</li>
          <li><strong>Domicilio legal:</strong> Av. Diaz Velez 4762, CABA, Buenos Aires, Argentina.</li>
          <li><strong>CUIT:</strong> 20-33740915-7.</li>
          <li><strong>Canal de contacto:</strong> <a href="mailto:contacto@citadely.com.ar">contacto@citadely.com.ar</a>.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Cuentas y uso de la plataforma">
        <p>Para usar el dashboard, el negocio debe crear una cuenta y mantener actualizados sus datos de acceso. La persona titular de la cuenta es responsable de las acciones realizadas desde ella y de configurar la información pública de su negocio.</p>
        <p>No se debe usar la plataforma para suplantar identidades, publicar información falsa, afectar a otras personas o interferir con el funcionamiento del servicio.</p>
      </LegalSection>

      <LegalSection title="Reservas públicas y señas">
        <p>Quien reserva elige un servicio, fecha y horario disponibles, completa sus datos y recibe la confirmación por correo electrónico. Debe proporcionar información correcta para que el negocio pueda gestionar el turno.</p>
        <p>El negocio define disponibilidad, precios y, cuando corresponde, monto de la seña y datos propios de transferencia. Citadely muestra y registra el estado de la seña; la recepción y confirmación de esa transferencia quedan a cargo del negocio. Las condiciones de cambio o cancelación de un turno deben acordarse con ese negocio.</p>
      </LegalSection>

      <LegalSection title="Prueba, planes y cobros">
        <p>La prueba gratuita dura 7 días e incluye las funciones del plan Pro. Luego, el negocio puede elegir Esencial, con herramientas de gestión, o Pro, que además incluye la página pública y reservas online. Los precios y funciones vigentes se muestran antes de elegir el plan.</p>
        <p>Las suscripciones son mensuales y se autorizan mediante Mercado Pago. El acceso pago se activa cuando Mercado Pago confirma el primer cobro aprobado. Los cambios de plan se aplican conforme al período de facturación que muestra la plataforma.</p>
      </LegalSection>

      <LegalSection title="Cancelación de la suscripción">
        <p>El negocio puede cancelar la renovación desde su configuración. La cancelación evita nuevos cobros periódicos y mantiene el acceso correspondiente al período ya abonado. El estado de la suscripción y la fecha de finalización se muestran en el dashboard.</p>
        <p>Los pagos, reembolsos y contracargos se procesan según el estado que comunique Mercado Pago y la normativa aplicable. Para consultas, escribí a <a href="mailto:contacto@citadely.com.ar">contacto@citadely.com.ar</a>.</p>
      </LegalSection>

      <LegalSection title="Contenido y disponibilidad">
        <p>El negocio es responsable de los textos, imágenes, horarios, servicios y datos de contacto que publica. Debe contar con autorización para usar ese contenido y mantenerlo actualizado.</p>
        <p>Citadely puede realizar mantenimiento y correcciones para conservar el funcionamiento de la plataforma. Si una función no está disponible temporalmente, las reservas y operaciones deben verificarse en el dashboard cuando vuelva a estar accesible.</p>
      </LegalSection>

      <LegalSection title="Privacidad y cambios">
        <p>El tratamiento de datos personales se describe en la <Link href="/politica-de-privacidad">Política de privacidad</Link>.</p>
        <p>Los cambios en las condiciones se reflejarán con una nueva fecha de revisión.</p>
      </LegalSection>
    </LegalPageLayout>
  );
}
