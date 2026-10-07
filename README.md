# Plataforma de Portafolios Estudiantiles

Plataforma cloud para almacenar y consultar portafolios estudiantiles utilizando servicios administrados de AWS y AWS CDK como infraestructura como código.

El proyecto implementa almacenamiento privado de archivos en Amazon S3, distribución global mediante Amazon CloudFront, metadatos en Amazon DynamoDB y permisos controlados mediante IAM.

---

## 1. Objetivo

Construir una plataforma cloud para portafolios estudiantiles que permita:

- Almacenar los archivos de los portafolios.
- Mantener el almacenamiento S3 privado.
- Entregar el contenido mediante CloudFront.
- Almacenar información de los estudiantes en DynamoDB.
- Proteger archivos privados mediante CloudFront Signed URLs.
- Aplicar permisos mínimos mediante IAM.
- Gestionar toda la infraestructura mediante AWS CDK.

---

## 2. Arquitectura

La arquitectura implementada está compuesta por los siguientes servicios:

```text
                         Internet
                            │
                            ▼
                   ┌─────────────────┐
                   │   CloudFront    │
                   │  Price Class    │
                   │      200        │
                   └────────┬────────┘
                            │
                  Origin Access Control
                            │
                            ▼
                   ┌─────────────────┐
                   │       S3        │
                   │  Bucket privado │
                   └─────────────────┘
                            │
                  ┌─────────┴─────────┐
                  │                   │
             Contenido público   /private/*
                                  Signed URL
                                 requerida


                   ┌─────────────────┐
                   │   DynamoDB      │
                   │   Portfolios    │
                   └─────────────────┘
                            │
                            ▼
                       studentId

Flujo de archivos públicos
1. El usuario solicita el sitio mediante CloudFront.
2. CloudFront recibe la solicitud.
3. CloudFront utiliza Origin Access Control (OAC) para acceder al bucket S3.
4. S3 entrega el archivo a CloudFront.
5. CloudFront devuelve el contenido al usuario.
El bucket S3 no permite acceso público directo.
Flujo de archivos privados
Los archivos ubicados dentro de:
/private/*

requieren una CloudFront Signed URL.
CloudFront valida la firma utilizando el Key Group y la clave pública configurada en la distribución.
3. Servicios AWS utilizados
Amazon S3
Se utiliza para almacenar los archivos de los portafolios.
Características:
- Bucket privado.
- Bloqueo de acceso público.
- Cifrado administrado por S3.
- Acceso mediante CloudFront OAC.
- Eliminación automática de objetos durante cdk destroy.
Amazon CloudFront
Se utiliza como CDN para distribuir el contenido.
Configuración:
- Origin Access Control (OAC).
- Redirección HTTP → HTTPS.
- index.html como documento raíz.
- Price Class 200.
- Comportamiento /private/* protegido mediante Signed URLs.
Amazon DynamoDB
Se utiliza para almacenar los metadatos de los portafolios.
Clave primaria:
studentId

Ejemplo de registro:
{
  "studentId": "student-001",
  "studentName": "Sebastian",
  "fecha": "2026-10-07",
  "portfolioUrl": "https://example.com/student-001"
}

La tabla utiliza PAY_PER_REQUEST, por lo que no requiere administrar capacidad provisionada.
AWS IAM
Se utilizan roles y políticas para controlar el acceso a los recursos.
El rol de la aplicación tiene permisos para:
- Escribir objetos en S3.
- Leer información de DynamoDB.
Los permisos están limitados a los recursos utilizados por la aplicación.
4. Seguridad
La plataforma implementa diferentes mecanismos de seguridad:
S3 privado
El bucket tiene habilitado:
BlockPublicAcls
IgnorePublicAcls
BlockPublicPolicy
RestrictPublicBuckets

Por lo tanto, los objetos no pueden ser accedidos directamente de forma pública desde S3.
CloudFront OAC
CloudFront utiliza Origin Access Control para acceder al bucket S3.
La política del bucket permite s3:GetObject al servicio CloudFront y restringe el acceso mediante el ARN de la distribución.
HTTPS
CloudFront redirige las solicitudes HTTP hacia HTTPS.
Signed URLs
Los archivos privados ubicados en /private/* requieren una URL firmada.
La clave privada utilizada para generar las URLs firmadas se mantiene únicamente de forma local y no se incluye en el repositorio.
La clave pública sí forma parte de la infraestructura y se utiliza para validar las firmas.
5. Boss Fight: Archivos privados mediante Signed URLs
Para resolver el Boss Fight se implementó un mecanismo de acceso diferenciado:
- Los archivos normales pueden ser entregados mediante CloudFront.
- Los archivos ubicados en /private/* requieren una Signed URL.
- S3 permanece completamente privado.
- CloudFront utiliza un Key Group para validar las firmas.
- La distribución utiliza Price Class 200.
De esta forma, un usuario sin una URL firmada recibe:
HTTP 403 Forbidden

Mientras que una solicitud realizada mediante una Signed URL válida permite acceder al archivo:
HTTP 200 OK

6. Pruebas realizadas
Se realizaron las siguientes pruebas:
CloudFront
Se verificó que la distribución respondiera correctamente:
HTTP/2 200

Acceso directo a S3
Se intentó acceder directamente al objeto mediante S3 sin autenticación.
Resultado:
HTTP 403 Forbidden

Esto confirma que el bucket permanece privado.
Archivos privados
Se solicitó directamente un archivo ubicado en:
/private/prueba-privada.txt

Resultado sin firma:
HTTP 403 Forbidden

Posteriormente se generó una Signed URL válida.
Resultado:
HTTP 200

DynamoDB
Se verificó el registro:
{
  "studentId": "student-001",
  "studentName": "Sebastian",
  "fecha": "2026-10-07",
  "portfolioUrl": "https://example.com/student-001"
}

CloudFront
Se verificó que la distribución estuviera desplegada correctamente y configurada con:
Price Class: PriceClass_200
Default Root Object: index.html

7. Estructura del proyecto
portfolio-platform/
│
├── bin/
│   └── portfolio-platform.ts
│
├── lib/
│   └── portfolio-platform-stack.ts
│
├── website/
│   ├── index.html
│   └── private/
│       └── prueba-privada.txt
│
├── keys/
│   └── cloudfront-public-key.pem
│
├── .gitignore
├── cdk.json
├── package.json
├── package-lock.json
└── README.md

La clave privada de CloudFront no se encuentra en el repositorio y está excluida mediante .gitignore.
8. Infraestructura como código
La infraestructura se define utilizando AWS CDK con TypeScript.
Comandos principales:
Instalar dependencias
npm install

Compilar
npm run build

Sintetizar CloudFormation
cdk synth

Comparar cambios
cdk diff

Desplegar
cdk deploy

Eliminar la infraestructura
cdk destroy

9. Recursos principales creados
El stack PortfolioPlatformStack crea:
- Amazon S3 Bucket.
- Amazon DynamoDB Table.
- Amazon CloudFront Distribution.
- CloudFront Origin Access Control.
- CloudFront Public Key.
- CloudFront Key Group.
- IAM Role.
- IAM Policies.
- Recursos personalizados de CDK para DynamoDB y despliegue del sitio.
10. Tecnologías utilizadas
- AWS CDK
- TypeScript
- Amazon S3
- Amazon CloudFront
- Amazon DynamoDB
- AWS IAM
- AWS CloudFormation
11. Estado del proyecto
La infraestructura fue desplegada y probada correctamente en AWS.
Las pruebas confirmaron:
- S3 privado.
- Acceso mediante CloudFront.
- HTTPS.
- DynamoDB operativo.
- Archivos privados protegidos mediante Signed URLs.
- CloudFront configurado con Price Class 200.
- Permisos IAM definidos.