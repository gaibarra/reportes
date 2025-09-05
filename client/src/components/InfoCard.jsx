import PropTypes from 'prop-types';
import { Card, CardContent, Typography } from '@mui/material';

const InfoCard = ({ title, value }) => (
  <Card>
    <CardContent>
      <Typography variant="overline" color="textSecondary">
        {title}
      </Typography>
      <Typography variant="h4" component="div">
        {value}
      </Typography>
    </CardContent>
  </Card>
);

InfoCard.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
};

export default InfoCard;
