import React from "react";

interface Props extends React.ImgHTMLAttributes<HTMLImageElement> {
    src?: string;
}

const CachedImage: React.FC<Props> = ({ src, alt, ...props }) => {
    return <img src={src} alt={alt} {...props} />;
};

export default CachedImage;
