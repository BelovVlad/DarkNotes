export function BrandMark({ size = 36 }: { size?: number }) {
  return <img className="brand-icon" src={import.meta.env.BASE_URL + 'icon.svg'} width={size} height={size} alt="" aria-hidden/>;
}
